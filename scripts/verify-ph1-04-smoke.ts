import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  createConversationWorkspaceDetail,
  createDraftPanelState,
  createInboxConversationListItem,
  resolveSelectedConversationId,
} from "../lib/conversations/models.ts";
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

async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  const supabaseUrl = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const hotelId = env.DEMO_HOTEL_ID ?? "11111111-1111-1111-1111-111111111111";
  const externalUserId = "ph1-04-smoke-guest";
  const externalMessageId = "555001:778";

  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
    update_id: 123457,
    message: {
      message_id: 778,
      date: 1_710_000_060,
      text: "PH1-04 smoke test message",
      chat: { id: 555001 },
      from: {
        id: externalUserId,
        username: "ph1_04_smoke",
        first_name: "Workspace",
        last_name: "Guest",
        language_code: "en",
      },
    },
  };

  const integration = {
    integrationId: "ph1-04-smoke-integration",
    hotelId,
    channel: "telegram" as const,
    botUsername: "smoke_bot",
    webhookPathToken: "ph1-04-smoke-webhook",
    isActive: true as const,
  };

  const ingestResult = await processTelegramInboundUpdate(integration, payload);
  if (ingestResult.status !== "message_ingested") {
    throw new Error(`Expected PH1-04 smoke setup to ingest a message, got ${ingestResult.status}.`);
  }

  const { data: createdGuestRow, error: createdGuestError } = await supabase
    .from("guests")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("external_user_id", externalUserId)
    .limit(1)
    .maybeSingle();
  if (createdGuestError) {
    throw createdGuestError;
  }
  const createdGuestId = (createdGuestRow as { id: string } | null)?.id ?? null;
  if (!createdGuestId) {
    throw new Error("Expected PH1-04 smoke guest to exist after ingestion.");
  }

  const { data: createdConversationRow, error: createdConversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("guest_id", createdGuestId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (createdConversationError) {
    throw createdConversationError;
  }
  const createdConversationId = (createdConversationRow as { id: string } | null)?.id ?? null;
  if (!createdConversationId) {
    throw new Error("Expected PH1-04 smoke conversation to exist after ingestion.");
  }

  const { data: conversationRows, error: conversationsError } = await supabase
    .from("conversations")
    .select(
      "id, guest_id, channel, status, mode, assigned_hotel_user_id, last_message_preview, last_message_at, last_inbound_message_at, unread_count, last_ai_draft_at",
    )
    .eq("hotel_id", hotelId)
    .order("last_message_at", { ascending: false });
  if (conversationsError) {
    throw conversationsError;
  }

  const { data: guestRows, error: guestsError } = await supabase
    .from("guests")
    .select("id, display_name, telegram_username, first_name, last_name, language_code, last_message_at")
    .eq("hotel_id", hotelId);
  if (guestsError) {
    throw guestsError;
  }

  const guestMap = new Map(
    ((guestRows ?? []) as Array<{
      id: string;
      display_name: string | null;
      telegram_username: string | null;
      first_name: string | null;
      last_name: string | null;
      language_code: string | null;
      last_message_at: string | null;
    }>).map((guest) => [guest.id, guest] as const),
  );

  const conversations = ((conversationRows ?? []) as Array<{
    id: string;
    guest_id: string;
    channel: "telegram";
    status: "new" | "open" | "pending" | "closed";
    mode: "copilot_mode" | "human_handoff_mode";
    assigned_hotel_user_id: string | null;
    last_message_preview: string | null;
    last_message_at: string;
    last_inbound_message_at: string | null;
    unread_count: number;
    last_ai_draft_at: string | null;
  }>).map((conversation) =>
    createInboxConversationListItem(conversation, guestMap.get(conversation.guest_id) ?? null),
  );

  if (conversations.length === 0) {
    throw new Error("Expected inbox conversation list to contain at least one conversation.");
  }

  if (!conversations.some((conversation) => conversation.id === createdConversationId)) {
    throw new Error("Expected the created PH1-04 conversation to appear in the inbox list.");
  }

  const selectedConversationId = resolveSelectedConversationId(conversations, createdConversationId);
  if (!selectedConversationId) {
    throw new Error("Expected selected conversation id to resolve from inbox list.");
  }

  const { data: workspaceConversationRow, error: workspaceConversationError } = await supabase
    .from("conversations")
    .select(
      "id, guest_id, channel, status, mode, assigned_hotel_user_id, subject, last_message_preview, last_message_at, last_inbound_message_at, unread_count, last_ai_draft_at, created_at",
    )
    .eq("hotel_id", hotelId)
    .eq("id", selectedConversationId)
    .limit(1)
    .maybeSingle();
  if (workspaceConversationError) {
    throw workspaceConversationError;
  }
  const workspaceConversation = (workspaceConversationRow as
    | {
        id: string;
        guest_id: string;
        channel: "telegram";
        status: "new" | "open" | "pending" | "closed";
        mode: "copilot_mode" | "human_handoff_mode";
        assigned_hotel_user_id: string | null;
        subject: string | null;
        last_message_preview: string | null;
        last_message_at: string;
        last_inbound_message_at: string | null;
        unread_count: number;
        last_ai_draft_at: string | null;
        created_at: string;
      }
    | null) ?? null;

  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("id, conversation_id, guest_id, direction, message_type, text_body, created_at, delivered_at")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", selectedConversationId)
    .order("created_at", { ascending: true });
  if (messageError) {
    throw messageError;
  }

  const workspace = workspaceConversation
    ? createConversationWorkspaceDetail({
        conversation: workspaceConversation,
        guest: guestMap.get(workspaceConversation.guest_id) ?? null,
        messages:
          (messageRows ?? []) as Array<{
            id: string;
            conversation_id: string;
            guest_id: string | null;
            direction: "inbound" | "outbound";
            message_type: "text";
            text_body: string;
            created_at: string;
            delivered_at: string | null;
          }>,
        draftPanel: createDraftPanelState(),
      })
    : null;
  if (!workspace) {
    throw new Error("Expected conversation workspace detail to resolve.");
  }

  if (workspace.conversation.id !== selectedConversationId) {
    throw new Error("Workspace detail did not match the selected conversation id.");
  }

  if (workspace.guest.displayName !== "Workspace Guest") {
    throw new Error(`Expected guest display name 'Workspace Guest', got '${workspace.guest.displayName}'.`);
  }

  if (workspace.messages.length === 0) {
    throw new Error("Expected workspace timeline to contain at least one message.");
  }

  if (workspace.messages[0].textBody !== "PH1-04 smoke test message") {
    throw new Error("Expected workspace timeline to expose the ingested text body.");
  }

  if (workspace.draftPanel.state !== "not_available_yet") {
    throw new Error(`Expected draft placeholder state, got '${workspace.draftPanel.state}'.`);
  }

  console.log("PH1-04 smoke verification passed.");
  console.log(`conversation=${workspace.conversation.id} guest=${workspace.guest.id} selected=${selectedConversationId}`);
}

main().catch((error) => {
  console.error("PH1-04 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
