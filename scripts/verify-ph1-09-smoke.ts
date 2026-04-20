import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createServiceRoleSupabaseClient } from "../lib/supabase/admin.ts";
import { encryptSecret } from "../lib/security/secrets.ts";
import { createWebhookPathToken } from "../lib/telegram/integrations.ts";
import { processTelegramInboundUpdate } from "../lib/telegram/inbound.ts";
import { sendConversationReply, selectConversationDraft } from "../lib/conversations/replies.ts";
import { listLatestConversationDraftsWithClient } from "../lib/copilot/store.ts";

const envPath = path.join(process.cwd(), ".env.local");
const hotelIdFallback = "11111111-1111-1111-1111-111111111111";
const smokeUsers = [
  "ph1-09-smoke-supported",
  "ph1-09-smoke-unsupported",
  "ph1-09-smoke-retryable",
  "ph1-09-smoke-ambiguous",
] as const;
const smokeIntegrationName = "PH1-09 smoke integration";
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
async function ensureSmokeIntegration(hotelId: string, actorHotelUserId: string) {
  const supabase = createServiceRoleSupabaseClient();
  await supabase.from("channel_integrations").delete().eq("hotel_id", hotelId).eq("name", smokeIntegrationName);
  const { data, error } = await supabase
    .from("channel_integrations")
    .insert({
      hotel_id: hotelId,
      channel: "telegram",
      name: smokeIntegrationName,
      bot_token_encrypted: encryptSecret("123456:PH1_09_SMOKE_TOKEN_EXAMPLE"),
      bot_username: "ph1_09_smoke_bot",
      webhook_path_token: createWebhookPathToken(),
      is_active: true,
      created_by_hotel_user_id: actorHotelUserId,
      last_verified_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
async function cleanupSmokeData(hotelId: string) {
  const supabase = createServiceRoleSupabaseClient();
  await supabase.from("channel_integrations").delete().eq("hotel_id", hotelId).eq("name", smokeIntegrationName);
  await supabase.from("faq_items").delete().eq("hotel_id", hotelId).like("question", "PH1-09 smoke%");

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
  }
  if (messageIds.length > 0) {
    await supabase.from("messages").delete().eq("hotel_id", hotelId).in("id", messageIds);
  }
  if (conversationIds.length > 0) {
    await supabase.from("conversations").delete().eq("hotel_id", hotelId).in("id", conversationIds);
  }
  if (guestIds.length > 0) {
    await supabase.from("guests").delete().eq("hotel_id", hotelId).in("id", guestIds);
  }
  const entityIds = [...guestIds, ...conversationIds, ...messageIds];
  if (entityIds.length > 0) {
    await supabase.from("event_logs").delete().eq("hotel_id", hotelId).in("entity_id", entityIds);
  }
}
async function createFaqItem(hotelId: string, actorHotelUserId: string, question: string, answer: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("faq_items").insert({
    hotel_id: hotelId,
    question,
    answer,
    is_published: true,
    published_at: new Date().toISOString(),
    created_by_hotel_user_id: actorHotelUserId,
    updated_by_hotel_user_id: actorHotelUserId,
  } as never);
  if (error) throw error;
}
function createPayload(input: { updateId: number; messageId: number; chatId: number; externalUserId: string; username: string; text: string }) {
  return {
    update_id: input.updateId,
    message: {
      message_id: input.messageId,
      date: 1_710_000_000,
      text: input.text,
      chat: { id: input.chatId },
      from: { id: input.externalUserId, username: input.username, first_name: "Smoke", last_name: "Guest", language_code: "en" },
    },
  };
}
async function findConversationAndLatestDraftId(hotelId: string, externalUserId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("external_user_id", externalUserId)
    .limit(1)
    .maybeSingle();
  if (guestError) throw guestError;
  const guestId = (guest as { id: string } | null)?.id;
  if (!guestId) throw new Error(`Expected smoke guest for ${externalUserId}.`);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("guest_id", guestId)
    .limit(1)
    .maybeSingle();
  if (conversationError) throw conversationError;
  const conversationId = (conversation as { id: string } | null)?.id;
  if (!conversationId) throw new Error(`Expected conversation for ${externalUserId}.`);

  const drafts = await listLatestConversationDraftsWithClient(supabase, hotelId, conversationId);
  return { conversationId, latestDraftId: drafts[0]?.id ?? null };
}
async function listMessageRows(hotelId: string, conversationId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, source_draft_id, delivery_status, text_body")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; direction: "inbound" | "outbound"; source_draft_id: string | null; delivery_status: string | null; text_body: string }>;
}
async function listConversationEvents(hotelId: string, entityId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("event_logs")
    .select("event_type, payload")
    .eq("hotel_id", hotelId)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ event_type: string; payload: Record<string, unknown> }>;
}
async function withStubbedFetch<T>(handler: typeof fetch, callback: () => Promise<T>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = requireEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.env.SUPABASE_SERVICE_ROLE_KEY = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  process.env.TELEGRAM_TOKEN_ENCRYPTION_SECRET = requireEnv(env, "TELEGRAM_TOKEN_ENCRYPTION_SECRET");

  const hotelId = env.DEMO_HOTEL_ID ?? hotelIdFallback;
  const actorHotelUserId = await findActiveHotelUserId(hotelId);
  if (!actorHotelUserId) throw new Error("Expected an active hotel user for PH1-09 smoke verification.");

  await cleanupSmokeData(hotelId);
  const integrationId = await ensureSmokeIntegration(hotelId, actorHotelUserId);
  await createFaqItem(hotelId, actorHotelUserId, "PH1-09 smoke what time is breakfast served", "Breakfast is served daily from 07:00 to 10:30.");
  const integration = { integrationId, hotelId, channel: "telegram" as const, botUsername: "ph1_09_smoke_bot", webhookPathToken: "ph1-09-smoke-webhook", isActive: true as const };
  await processTelegramInboundUpdate(integration, createPayload({ updateId: 910001, messageId: 901, chatId: 559001, externalUserId: "ph1-09-smoke-supported", username: "ph1_09_supported", text: "What time is breakfast served?" }));
  await processTelegramInboundUpdate(integration, createPayload({ updateId: 910002, messageId: 902, chatId: 559002, externalUserId: "ph1-09-smoke-unsupported", username: "ph1_09_unsupported", text: "Can I change my booking and get a refund?" }));
  await processTelegramInboundUpdate(integration, createPayload({ updateId: 910003, messageId: 903, chatId: 559003, externalUserId: "ph1-09-smoke-retryable", username: "ph1_09_retryable", text: "What time is breakfast served?" }));
  await processTelegramInboundUpdate(integration, createPayload({ updateId: 910004, messageId: 904, chatId: 559004, externalUserId: "ph1-09-smoke-ambiguous", username: "ph1_09_ambiguous", text: "What time is breakfast served?" }));
  const supported = await findConversationAndLatestDraftId(hotelId, "ph1-09-smoke-supported");
  const unsupported = await findConversationAndLatestDraftId(hotelId, "ph1-09-smoke-unsupported");
  const retryable = await findConversationAndLatestDraftId(hotelId, "ph1-09-smoke-retryable");
  const ambiguous = await findConversationAndLatestDraftId(hotelId, "ph1-09-smoke-ambiguous");
  assert.notEqual(supported.latestDraftId, null);
  assert.equal(unsupported.latestDraftId, null);
  await selectConversationDraft({ hotelId, conversationId: supported.conversationId, draftId: supported.latestDraftId as string, actorHotelUserId });
  await withStubbedFetch(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 9901 } }), { status: 200 }), async () => {
    const result = await sendConversationReply({ hotelId, conversationId: supported.conversationId, replyText: "Breakfast is served from 07:00 to 10:30.", selectedDraftId: supported.latestDraftId, actorHotelUserId, operationKey: crypto.randomUUID() });
    assert.equal(result.outcome, "sent");
  });

  await withStubbedFetch(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 9902 } }), { status: 200 }), async () => {
    const result = await sendConversationReply({ hotelId, conversationId: unsupported.conversationId, replyText: "Please contact the front desk so we can review your booking request manually.", selectedDraftId: null, actorHotelUserId, operationKey: crypto.randomUUID() });
    assert.equal(result.outcome, "sent");
  });

  await withStubbedFetch(async () => new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 }), async () => {
    const result = await sendConversationReply({ hotelId, conversationId: retryable.conversationId, replyText: "Breakfast is served from 07:00 to 10:30.", selectedDraftId: retryable.latestDraftId, actorHotelUserId, operationKey: crypto.randomUUID() });
    assert.deepEqual(result.outcome, "failed");
    assert.equal(result.failureType, "retryable");
  });

  await withStubbedFetch(async () => {
    throw new Error("socket hang up");
  }, async () => {
    const result = await sendConversationReply({ hotelId, conversationId: ambiguous.conversationId, replyText: "Breakfast is served from 07:00 to 10:30.", selectedDraftId: ambiguous.latestDraftId, actorHotelUserId, operationKey: crypto.randomUUID() });
    assert.deepEqual(result.outcome, "failed");
    assert.equal(result.failureType, "ambiguous");
  });
  const supportedMessages = await listMessageRows(hotelId, supported.conversationId);
  assert.equal(supportedMessages.some((message) => message.direction === "outbound" && message.delivery_status === "sent" && message.source_draft_id === supported.latestDraftId), true);
  const unsupportedMessages = await listMessageRows(hotelId, unsupported.conversationId);
  assert.equal(unsupportedMessages.some((message) => message.direction === "outbound" && message.delivery_status === "sent" && message.source_draft_id === null), true);
  const retryableMessages = await listMessageRows(hotelId, retryable.conversationId);
  assert.equal(retryableMessages.some((message) => message.direction === "outbound" && message.delivery_status === "failed_retryable"), true);
  const ambiguousMessages = await listMessageRows(hotelId, ambiguous.conversationId);
  assert.equal(ambiguousMessages.some((message) => message.direction === "outbound" && message.delivery_status === "failed_ambiguous"), true);

  const supportedEvents = await listConversationEvents(hotelId, supported.conversationId);
  assert.equal(supportedEvents.some((event) => event.event_type === "conversation_draft_selected"), true);
  const sendRequested = supportedEvents.find((event) => event.event_type === "outbound_reply_send_requested");
  assert.equal(sendRequested?.payload?.source, "draft");
  assert.equal(Boolean(sendRequested?.payload?.messageId), true);
  const unsupportedEvents = await listConversationEvents(hotelId, unsupported.conversationId);
  assert.equal(unsupportedEvents.some((event) => event.event_type === "ai_drafts_suppressed"), true);
  const retryableAttemptId = retryableMessages.find((message) => message.delivery_status === "failed_retryable")?.id;
  const ambiguousAttemptId = ambiguousMessages.find((message) => message.delivery_status === "failed_ambiguous")?.id;
  assert.equal((await listConversationEvents(hotelId, retryableAttemptId as string)).some((event) => event.event_type === "outbound_reply_failed" && event.payload?.failureType === "retryable"), true);
  assert.equal((await listConversationEvents(hotelId, ambiguousAttemptId as string)).some((event) => event.event_type === "outbound_reply_failed" && event.payload?.failureType === "ambiguous"), true);

  console.log("PH1-09 smoke verification passed.");
  console.log(`supported=${supported.conversationId} unsupported=${unsupported.conversationId} retryable=${retryable.conversationId} ambiguous=${ambiguous.conversationId}`);
}

main().catch((error) => {
  console.error("PH1-09 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
