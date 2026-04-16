import { createServiceRoleSupabaseClient } from "../supabase/admin.ts";
import type { Json, Database } from "../../types/database.ts";
import type { ActiveTelegramIntegration } from "./integrations.ts";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

type TelegramMessagePayload = {
  message_id?: number;
  date?: number;
  text?: string;
  chat?: { id?: number | string };
  from?: {
    id?: number | string;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
  };
};

type TelegramUpdatePayload = {
  update_id?: number;
  message?: TelegramMessagePayload;
};

export type ParsedInboundTelegramTextMessage = {
  integrationId: string;
  hotelId: string;
  updateId: string | null;
  externalMessageId: string;
  externalChatId: string;
  senderExternalId: string;
  textBody: string;
  sentAt: string | null;
  telegramUser: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    languageCode: string | null;
  };
};

export type TelegramInboundProcessResult =
  | { ok: true; status: "message_ingested"; conversationId: string; messageId: string; guestId: string }
  | { ok: true; status: "duplicate_ignored"; conversationId: string | null; messageId: string | null; guestId: string | null }
  | { ok: true; status: "update_ignored"; reason: string };

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildDisplayName(user: ParsedInboundTelegramTextMessage["telegramUser"]) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username) return `@${user.username}`;
  return "Telegram guest";
}

function previewText(textBody: string) {
  return textBody.length > 160 ? `${textBody.slice(0, 157)}...` : textBody;
}

export function parseTelegramInboundUpdate(
  integration: ActiveTelegramIntegration,
  payload: TelegramUpdatePayload,
): ParsedInboundTelegramTextMessage | { ignored: true; reason: string } {
  if (!payload || typeof payload !== "object") {
    return { ignored: true, reason: "invalid_payload_shape" };
  }

  const message = payload.message;
  if (!message || typeof message !== "object") {
    return { ignored: true, reason: "unsupported_update_type" };
  }

  const textBody = normalizeText(message.text);
  if (!textBody) {
    return { ignored: true, reason: "missing_text_body" };
  }

  const telegramMessageId = message.message_id;
  const externalChatId = message.chat?.id;
  const senderExternalId = message.from?.id;
  if (telegramMessageId == null || externalChatId == null || senderExternalId == null) {
    return { ignored: true, reason: "missing_message_identity" };
  }

  return {
    integrationId: integration.integrationId,
    hotelId: integration.hotelId,
    updateId: payload.update_id != null ? String(payload.update_id) : null,
    externalMessageId: `${String(externalChatId)}:${String(telegramMessageId)}`,
    externalChatId: String(externalChatId),
    senderExternalId: String(senderExternalId),
    textBody,
    sentAt: message.date ? new Date(message.date * 1000).toISOString() : null,
    telegramUser: {
      username: message.from?.username ?? null,
      firstName: message.from?.first_name ?? null,
      lastName: message.from?.last_name ?? null,
      languageCode: message.from?.language_code ?? null,
    },
  };
}

async function findExistingInboundMessage(input: ParsedInboundTelegramTextMessage) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("hotel_id", input.hotelId)
    .eq("channel", "telegram")
    .eq("direction", "inbound")
    .eq("external_message_id", input.externalMessageId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as MessageRow | null) ?? null;
}

async function resolveOrCreateGuest(input: ParsedInboundTelegramTextMessage) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: existing, error: selectError } = await supabase
    .from("guests")
    .select("*")
    .eq("hotel_id", input.hotelId)
    .eq("channel", "telegram")
    .eq("external_user_id", input.senderExternalId)
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;

  const profile = {
    telegram_username: input.telegramUser.username,
    display_name: buildDisplayName(input.telegramUser),
    first_name: input.telegramUser.firstName,
    last_name: input.telegramUser.lastName,
    language_code: input.telegramUser.languageCode,
    last_message_at: input.sentAt ?? new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("guests")
      .update(profile as never)
      .eq("id", (existing as GuestRow).id)
      .select("*")
      .single();
    if (error) throw error;
    return data as GuestRow;
  }

  const { data, error } = await supabase
    .from("guests")
    .insert(
      {
        hotel_id: input.hotelId,
        channel: "telegram",
        external_user_id: input.senderExternalId,
        ...profile,
      } as never,
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as GuestRow;
}

async function resolveOrCreateConversation(input: ParsedInboundTelegramTextMessage, guestId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: existing, error: selectError } = await supabase
    .from("conversations")
    .select("*")
    .eq("hotel_id", input.hotelId)
    .eq("guest_id", guestId)
    .in("status", ["new", "open", "pending"])
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as ConversationRow;

  const { data, error } = await supabase
    .from("conversations")
    .insert(
      {
        hotel_id: input.hotelId,
        guest_id: guestId,
        channel: "telegram",
        status: "new",
        mode: "copilot_mode",
        last_message_at: input.sentAt ?? new Date().toISOString(),
      } as never,
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as ConversationRow;
}

async function persistInboundMessage(
  input: ParsedInboundTelegramTextMessage,
  conversationId: string,
  guestId: string,
  payload: Json,
) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .insert(
      {
        hotel_id: input.hotelId,
        conversation_id: conversationId,
        guest_id: guestId,
        channel: "telegram",
        direction: "inbound",
        message_type: "text",
        external_message_id: input.externalMessageId,
        external_chat_id: input.externalChatId,
        sender_external_id: input.senderExternalId,
        text_body: input.textBody,
        delivered_at: input.sentAt,
        raw_payload: payload,
      } as never,
    )
    .select("*")
    .single();

  if (error) {
    const duplicateError = error as Error & { code?: string };
    if (duplicateError.code === "23505") {
      const existing = await findExistingInboundMessage(input);
      if (existing) {
        return { duplicate: true as const, message: existing };
      }
    }
    throw error;
  }
  return { duplicate: false as const, message: data as MessageRow };
}

async function updateConversationAfterInbound(
  conversation: ConversationRow,
  input: ParsedInboundTelegramTextMessage,
) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("conversations")
    .update(
      {
        last_message_preview: previewText(input.textBody),
        last_message_at: input.sentAt ?? new Date().toISOString(),
        last_inbound_message_at: input.sentAt ?? new Date().toISOString(),
        unread_count: conversation.unread_count + 1,
        status: "open",
      } as never,
    )
    .eq("id", conversation.id);

  if (error) throw error;
}

export async function processTelegramInboundUpdate(
  integration: ActiveTelegramIntegration,
  payload: TelegramUpdatePayload,
): Promise<TelegramInboundProcessResult> {
  const parsed = parseTelegramInboundUpdate(integration, payload);
  if ("ignored" in parsed) {
    return { ok: true, status: "update_ignored", reason: parsed.reason };
  }

  const existingMessage = await findExistingInboundMessage(parsed);
  if (existingMessage) {
    return {
      ok: true,
      status: "duplicate_ignored",
      conversationId: existingMessage.conversation_id,
      messageId: existingMessage.id,
      guestId: existingMessage.guest_id,
    };
  }

  const guest = await resolveOrCreateGuest(parsed);
  const conversation = await resolveOrCreateConversation(parsed, guest.id);
  const persisted = await persistInboundMessage(parsed, conversation.id, guest.id, payload as Json);

  if (persisted.duplicate) {
    return {
      ok: true,
      status: "duplicate_ignored",
      conversationId: persisted.message.conversation_id,
      messageId: persisted.message.id,
      guestId: persisted.message.guest_id,
    };
  }

  await updateConversationAfterInbound(conversation, parsed);

  return {
    ok: true,
    status: "message_ingested",
    conversationId: conversation.id,
    messageId: persisted.message.id,
    guestId: guest.id,
  };
}
