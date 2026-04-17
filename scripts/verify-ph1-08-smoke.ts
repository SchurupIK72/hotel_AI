import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createServiceRoleSupabaseClient } from "../lib/supabase/admin.ts";
import { processTelegramInboundUpdate } from "../lib/telegram/inbound.ts";
import { generateConversationDraftsWithClient } from "../lib/copilot/generation.ts";
import { listLatestConversationDraftsWithClient } from "../lib/copilot/store.ts";
import { createDraftPanelState } from "../lib/conversations/models.ts";

const envPath = path.join(process.cwd(), ".env.local");
const hotelIdFallback = "11111111-1111-1111-1111-111111111111";
const smokeUsers = [
  "ph1-08-smoke-supported",
  "ph1-08-smoke-fallback",
  "ph1-08-smoke-unsupported",
] as const;

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {} as Record<string, string>;
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
      }),
  );
}

function requireEnv(env: Record<string, string | undefined>, name: string) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function findActiveHotelUserId(hotelId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("hotel_users")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("role", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return ((data as { id: string } | null) ?? null)?.id ?? null;
}

async function createFaqItem(hotelId: string, actorHotelUserId: string, question: string, answer: string, isPublished: boolean) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("faq_items")
    .insert({
      hotel_id: hotelId,
      question,
      answer,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      created_by_hotel_user_id: actorHotelUserId,
      updated_by_hotel_user_id: actorHotelUserId,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function cleanupSmokeData(hotelId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: guests, error: guestError } = await supabase
    .from("guests")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .in("external_user_id", [...smokeUsers]);
  if (guestError) throw guestError;

  const guestIds = ((guests ?? []) as Array<{ id: string }>).map((guest) => guest.id);
  const { data: conversations, error: conversationError } =
    guestIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("conversations").select("id").eq("hotel_id", hotelId).in("guest_id", guestIds);
  if (conversationError) throw conversationError;

  const conversationIds = ((conversations ?? []) as Array<{ id: string }>).map((conversation) => conversation.id);
  const { data: messages, error: messageError } =
    conversationIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("messages").select("id").eq("hotel_id", hotelId).in("conversation_id", conversationIds);
  if (messageError) throw messageError;

  const messageIds = ((messages ?? []) as Array<{ id: string }>).map((message) => message.id);
  if (conversationIds.length > 0) {
    await supabase.from("ai_drafts").delete().eq("hotel_id", hotelId).in("conversation_id", conversationIds);
    await supabase.from("conversations").delete().eq("hotel_id", hotelId).in("id", conversationIds);
  }
  if (messageIds.length > 0) {
    await supabase.from("messages").delete().eq("hotel_id", hotelId).in("id", messageIds);
  }
  if (guestIds.length > 0) {
    await supabase.from("guests").delete().eq("hotel_id", hotelId).in("id", guestIds);
  }
  const entityIds = [...guestIds, ...conversationIds, ...messageIds];
  if (entityIds.length > 0) {
    await supabase.from("event_logs").delete().eq("hotel_id", hotelId).in("entity_id", entityIds);
  }

  await supabase.from("faq_items").delete().eq("hotel_id", hotelId).like("question", "PH1-08 smoke%");
}

async function findConversationByExternalUserId(hotelId: string, externalUserId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("external_user_id", externalUserId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const guestId = (data as { id: string } | null)?.id;
  if (!guestId) throw new Error(`Expected guest for ${externalUserId}.`);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, last_ai_draft_at")
    .eq("hotel_id", hotelId)
    .eq("guest_id", guestId)
    .limit(1)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error(`Expected conversation for ${externalUserId}.`);

  return conversation as { id: string; last_ai_draft_at: string | null };
}

async function findLatestInboundMessageId(hotelId: string, conversationId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

async function listConversationEventLogs(hotelId: string, conversationId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("event_logs")
    .select("event_type, payload")
    .eq("hotel_id", hotelId)
    .eq("entity_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ event_type: string; payload: Record<string, unknown> }>;
}

async function buildLatestDraftPanel(hotelId: string, conversationId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const drafts = await listLatestConversationDraftsWithClient(supabase, hotelId, conversationId);
  return {
    drafts,
    panel: createDraftPanelState({ state: "empty", drafts }),
  };
}

function createPayload(input: {
  updateId: number;
  messageId: number;
  chatId: number;
  externalUserId: string;
  username: string;
  text: string;
}) {
  return {
    update_id: input.updateId,
    message: {
      message_id: input.messageId,
      date: 1_710_000_000,
      text: input.text,
      chat: { id: input.chatId },
      from: {
        id: input.externalUserId,
        username: input.username,
        first_name: "Smoke",
        last_name: "Guest",
        language_code: "en",
      },
    },
  };
}

async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = requireEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.env.SUPABASE_SERVICE_ROLE_KEY = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const hotelId = env.DEMO_HOTEL_ID ?? hotelIdFallback;
  const actorHotelUserId = await findActiveHotelUserId(hotelId);
  if (!actorHotelUserId) throw new Error("Expected an active hotel_user for PH1-08 smoke verification.");

  await cleanupSmokeData(hotelId);

  await createFaqItem(
    hotelId,
    actorHotelUserId,
    "PH1-08 smoke what time is breakfast served",
    "Breakfast is served daily from 07:00 to 10:30.",
    true,
  );
  await createFaqItem(
    hotelId,
    actorHotelUserId,
    "PH1-08 smoke airport shuttle",
    "Airport shuttle runs every hour from terminal A.",
    false,
  );

  const integration = {
    integrationId: "ph1-08-smoke-integration",
    hotelId,
    channel: "telegram" as const,
    botUsername: "smoke_bot",
    webhookPathToken: "ph1-08-smoke-webhook",
    isActive: true as const,
  };

  const supportedResult = await processTelegramInboundUpdate(
    integration,
    createPayload({
      updateId: 810001,
      messageId: 801,
      chatId: 558001,
      externalUserId: "ph1-08-smoke-supported",
      username: "ph1_08_supported",
      text: "What time is breakfast served?",
    }),
  );
  const fallbackResult = await processTelegramInboundUpdate(
    integration,
    createPayload({
      updateId: 810002,
      messageId: 802,
      chatId: 558002,
      externalUserId: "ph1-08-smoke-fallback",
      username: "ph1_08_fallback",
      text: "Do you have an airport shuttle?",
    }),
  );
  const unsupportedResult = await processTelegramInboundUpdate(
    integration,
    createPayload({
      updateId: 810003,
      messageId: 803,
      chatId: 558003,
      externalUserId: "ph1-08-smoke-unsupported",
      username: "ph1_08_unsupported",
      text: "Can I change my booking and get a refund?",
    }),
  );

  assert.equal(supportedResult.status, "message_ingested");
  assert.equal(fallbackResult.status, "message_ingested");
  assert.equal(unsupportedResult.status, "message_ingested");

  const supportedConversation = await findConversationByExternalUserId(hotelId, "ph1-08-smoke-supported");
  const fallbackConversation = await findConversationByExternalUserId(hotelId, "ph1-08-smoke-fallback");
  const unsupportedConversation = await findConversationByExternalUserId(hotelId, "ph1-08-smoke-unsupported");

  const supportedDrafts = await buildLatestDraftPanel(hotelId, supportedConversation.id);
  assert.equal(supportedConversation.last_ai_draft_at !== null, true);
  assert.equal(supportedDrafts.panel.state, "ready");
  assert.equal(supportedDrafts.drafts.length, 3);
  assert.equal(supportedDrafts.drafts[0]?.sourceType, "kb");
  assert.equal(supportedDrafts.drafts[0]?.confidenceLabel, "knowledge-backed");

  const fallbackDrafts = await buildLatestDraftPanel(hotelId, fallbackConversation.id);
  assert.equal(fallbackConversation.last_ai_draft_at !== null, true);
  assert.equal(fallbackDrafts.panel.state, "ready");
  assert.equal(fallbackDrafts.drafts.length, 2);
  assert.equal(fallbackDrafts.drafts[0]?.sourceType, "fallback");
  assert.equal(fallbackDrafts.drafts[0]?.confidenceLabel, "clarification-needed");

  const unsupportedDrafts = await buildLatestDraftPanel(hotelId, unsupportedConversation.id);
  assert.equal(unsupportedConversation.last_ai_draft_at, null);
  assert.equal(unsupportedDrafts.panel.state, "empty");
  assert.equal(unsupportedDrafts.drafts.length, 0);

  const supportedMessageId = await findLatestInboundMessageId(hotelId, supportedConversation.id);
  if (!supportedMessageId) throw new Error("Expected latest inbound message for supported smoke conversation.");
  const supabase = createServiceRoleSupabaseClient();
  const manualRegenerateResult = await generateConversationDraftsWithClient(supabase, {
    hotelId,
    conversationId: supportedConversation.id,
    triggerMessageId: supportedMessageId,
    trigger: "manual_regenerate",
  });
  assert.equal(manualRegenerateResult.outcome, "generated");
  assert.equal(manualRegenerateResult.drafts.length, 3);

  const supportedAfterRegenerate = await buildLatestDraftPanel(hotelId, supportedConversation.id);
  assert.equal(supportedAfterRegenerate.panel.state, "ready");
  assert.equal(supportedAfterRegenerate.drafts.length, 3);

  const { data: allSupportedDraftRows, error: supportedDraftRowsError } = await supabase
    .from("ai_drafts")
    .select("id, source_type, model_name")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", supportedConversation.id);
  if (supportedDraftRowsError) throw supportedDraftRowsError;
  assert.equal((allSupportedDraftRows ?? []).length, 6);

  const supportedEvents = await listConversationEventLogs(hotelId, supportedConversation.id);
  assert.equal(supportedEvents.some((event) => event.event_type === "ai_drafts_generated"), true);
  assert.equal(
    supportedEvents.filter((event) => event.event_type === "ai_drafts_generated").length >= 2,
    true,
  );

  const fallbackEvents = await listConversationEventLogs(hotelId, fallbackConversation.id);
  const fallbackGeneration = fallbackEvents.find((event) => event.event_type === "ai_drafts_generated");
  assert.equal(Boolean(fallbackGeneration), true);
  assert.equal(fallbackGeneration?.payload?.retrievalStatus, "no_relevant_evidence");
  assert.equal(fallbackGeneration?.payload?.draftCount, 2);

  const unsupportedEvents = await listConversationEventLogs(hotelId, unsupportedConversation.id);
  const suppressedEvent = unsupportedEvents.find((event) => event.event_type === "ai_drafts_suppressed");
  assert.equal(Boolean(suppressedEvent), true);
  assert.equal(suppressedEvent?.payload?.reason, "unsupported_request");

  console.log("PH1-08 smoke verification passed.");
  console.log(
    `supported=${supportedConversation.id} fallback=${fallbackConversation.id} unsupported=${unsupportedConversation.id}`,
  );
}

main().catch((error) => {
  console.error("PH1-08 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
