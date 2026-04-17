import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { processTelegramInboundUpdate } from "../lib/telegram/inbound.ts";
import type { Database } from "../types/database.ts";

const envPath = path.join(process.cwd(), ".env.local");

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {} as Record<string, string>;
  const result: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    result[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
  }
  return result;
}

function requireEnv(env: Record<string, string | undefined>, name: string) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function listConversationIds(
  supabase: ReturnType<typeof createClient<Database>>,
  input: { hotelId: string; filter: "all" | "unread" | "assigned_to_me"; currentHotelUserId: string },
) {
  let query = supabase.from("conversations").select("id").eq("hotel_id", input.hotelId);
  if (input.filter === "unread") query = query.gt("unread_count", 0);
  if (input.filter === "assigned_to_me") query = query.eq("assigned_hotel_user_id", input.currentHotelUserId);
  const { data, error } = await query.order("last_message_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}

async function getConversationState(
  supabase: ReturnType<typeof createClient<Database>>,
  hotelId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, status, assigned_hotel_user_id, unread_count")
    .eq("hotel_id", hotelId)
    .eq("id", conversationId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string; status: string; assigned_hotel_user_id: string | null; unread_count: number } | null) ?? null;
}

async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  const supabaseUrl = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const hotelId = env.DEMO_HOTEL_ID ?? "11111111-1111-1111-1111-111111111111";
  const externalUserId = "ph1-05-smoke-guest";
  const externalMessageId = "555002:779";
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: hotelUserRow, error: hotelUserError } = await supabase
    .from("hotel_users")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (hotelUserError) throw hotelUserError;
  const actorHotelUserId = (hotelUserRow as { id: string } | null)?.id ?? null;
  if (!actorHotelUserId) throw new Error("Expected at least one active hotel user for PH1-05 smoke verification.");

  const { data: existingGuest } = await supabase
    .from("guests")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("external_user_id", externalUserId)
    .limit(1)
    .maybeSingle();
  const existingGuestRow = (existingGuest as { id: string } | null) ?? null;

  if (existingGuestRow) {
    await supabase.from("messages").delete().eq("guest_id", existingGuestRow.id);
    await supabase.from("conversations").delete().eq("guest_id", existingGuestRow.id);
    await supabase.from("guests").delete().eq("id", existingGuestRow.id);
  }

  await supabase
    .from("messages")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("direction", "inbound")
    .eq("external_message_id", externalMessageId);

  const payload = {
    update_id: 123458,
    message: {
      message_id: 779,
      date: 1_710_000_120,
      text: "PH1-05 smoke test message",
      chat: { id: 555002 },
      from: {
        id: externalUserId,
        username: "ph1_05_smoke",
        first_name: "Operations",
        last_name: "Guest",
        language_code: "en",
      },
    },
  };

  const integration = {
    integrationId: "ph1-05-smoke-integration",
    hotelId,
    channel: "telegram" as const,
    botUsername: "smoke_bot",
    webhookPathToken: "ph1-05-smoke-webhook",
    isActive: true as const,
  };

  const ingestResult = await processTelegramInboundUpdate(integration, payload);
  if (ingestResult.status !== "message_ingested") throw new Error(`Expected PH1-05 smoke setup to ingest a message, got ${ingestResult.status}.`);

  const { data: guestRow, error: guestError } = await supabase
    .from("guests")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("external_user_id", externalUserId)
    .limit(1)
    .maybeSingle();
  if (guestError) throw guestError;
  const guestId = (guestRow as { id: string } | null)?.id ?? null;
  if (!guestId) throw new Error("Expected PH1-05 smoke guest to resolve after ingestion.");

  const { data: conversationRow, error: conversationError } = await supabase
    .from("conversations")
    .select("id, unread_count")
    .eq("hotel_id", hotelId)
    .eq("guest_id", guestId)
    .limit(1)
    .maybeSingle();
  if (conversationError) throw conversationError;
  const conversation = (conversationRow as { id: string; unread_count: number } | null) ?? null;
  if (!conversation) throw new Error("Expected the ingested conversation to appear in the all filter.");

  const allConversationIds = await listConversationIds(supabase, {
    hotelId,
    filter: "all",
    currentHotelUserId: actorHotelUserId,
  });
  if (!allConversationIds.includes(conversation.id)) {
    throw new Error("Expected the ingested conversation to appear in the all filter.");
  }

  if (conversation.unread_count < 1) {
    throw new Error("Expected the ingested conversation to start with unread_count > 0.");
  }

  const unreadBeforeClear = await listConversationIds(supabase, {
    hotelId,
    filter: "unread",
    currentHotelUserId: actorHotelUserId,
  });
  if (!unreadBeforeClear.includes(conversation.id)) {
    throw new Error("Expected the conversation to appear in the unread filter before open/clear.");
  }

  const { error: statusError } = await supabase
    .from("conversations")
    .update({ status: "pending" } as never)
    .eq("hotel_id", hotelId)
    .eq("id", conversation.id);
  if (statusError) {
    throw statusError;
  }

  const statusState = await getConversationState(supabase, hotelId, conversation.id);
  if (statusState?.status !== "pending") {
    throw new Error("Expected status update flow to move the conversation to pending.");
  }

  const { error: assignError } = await supabase
    .from("conversations")
    .update({ assigned_hotel_user_id: actorHotelUserId } as never)
    .eq("hotel_id", hotelId)
    .eq("id", conversation.id);
  if (assignError) {
    throw assignError;
  }

  const assignedState = await getConversationState(supabase, hotelId, conversation.id);
  if (assignedState?.assigned_hotel_user_id !== actorHotelUserId) {
    throw new Error("Expected assignment flow to assign the conversation to the current hotel user.");
  }

  const assignedToMe = await listConversationIds(supabase, {
    hotelId,
    filter: "assigned_to_me",
    currentHotelUserId: actorHotelUserId,
  });
  if (!assignedToMe.includes(conversation.id)) {
    throw new Error("Expected the conversation to appear in the assigned_to_me filter after assignment.");
  }

  const { error: unreadClearError } = await supabase
    .from("conversations")
    .update({ unread_count: 0 } as never)
    .eq("hotel_id", hotelId)
    .eq("id", conversation.id);
  if (unreadClearError) {
    throw unreadClearError;
  }

  const unreadClearedState = await getConversationState(supabase, hotelId, conversation.id);
  if (unreadClearedState?.unread_count !== 0) {
    throw new Error("Expected unread clearing flow to set unread_count to 0.");
  }

  const unreadAfterClear = await listConversationIds(supabase, {
    hotelId,
    filter: "unread",
    currentHotelUserId: actorHotelUserId,
  });
  if (unreadAfterClear.includes(conversation.id)) {
    throw new Error("Expected the conversation to disappear from the unread filter after clearing unread.");
  }

  if (unreadClearedState.status !== "pending" || unreadClearedState.assigned_hotel_user_id !== actorHotelUserId) {
    throw new Error("Expected conversation state to keep pending status and assignment after unread clearing.");
  }

  const { error: unassignError } = await supabase
    .from("conversations")
    .update({ assigned_hotel_user_id: null } as never)
    .eq("hotel_id", hotelId)
    .eq("id", conversation.id);
  if (unassignError) {
    throw unassignError;
  }

  const unassignedState = await getConversationState(supabase, hotelId, conversation.id);
  if (unassignedState?.assigned_hotel_user_id !== null) {
    throw new Error("Expected unassign flow to clear the assignment.");
  }

  const assignedAfterUnassign = await listConversationIds(supabase, {
    hotelId,
    filter: "assigned_to_me",
    currentHotelUserId: actorHotelUserId,
  });
  if (assignedAfterUnassign.includes(conversation.id)) {
    throw new Error("Expected the conversation to disappear from assigned_to_me after unassign.");
  }

  console.log("PH1-05 smoke verification passed.");
  console.log(`conversation=${conversation.id} actorHotelUser=${actorHotelUserId} unread=0 status=pending assigned=null`);
}

main().catch((error) => {
  console.error("PH1-05 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
