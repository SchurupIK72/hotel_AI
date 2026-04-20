import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "../supabase/admin.ts";
import { listLatestConversationDraftsWithClient } from "../copilot/store.ts";
import { createEventLogSafely } from "../events/event-logs.ts";
import { sendTelegramTextMessage } from "../telegram/api.ts";
import { getActiveTelegramIntegration, getTelegramClientConfig } from "../telegram/integrations.ts";
import {
  TelegramIntegrationUnavailableError,
  TelegramSendMessageError,
} from "../telegram/errors.ts";
import type { Database, Json } from "../../types/database.ts";

const TELEGRAM_TEXT_LIMIT = 4096;
const OUTBOUND_DELIVERY_STATUSES = ["sending", "sent", "failed_retryable", "failed_ambiguous"] as const;

type ReplyServiceSupabaseClient = {
  from: SupabaseClient<Database>["from"];
};
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type AiDraftRow = Database["public"]["Tables"]["ai_drafts"]["Row"];
type HotelUserRow = Database["public"]["Tables"]["hotel_users"]["Row"];

export type OutboundDeliveryStatus = (typeof OUTBOUND_DELIVERY_STATUSES)[number];

export type SendConversationReplyInput = {
  hotelId: string;
  conversationId: string;
  replyText: string;
  selectedDraftId?: string | null;
  actorHotelUserId: string;
  operationKey: string;
};

export type SendConversationReplyResult =
  | {
      outcome: "sent";
      messageId: string;
      conversationId: string;
      sourceDraftId: string | null;
      deliveredAt: string;
    }
  | {
      outcome: "failed";
      failureType: "retryable" | "ambiguous";
      message: string;
      persistedAttemptId?: string | null;
    };

export type SelectConversationDraftResult =
  | {
      ok: true;
      draftId: string;
      draftText: string;
    }
  | {
      ok: false;
      errorCode: "not_found" | "invalid_actor";
      errorMessage: string;
    };

export type ConversationReplySupport = {
  hasActiveTelegramIntegration: boolean;
  hasResolvableTarget: boolean;
  disabledReason: string | null;
};

class ReplyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplyValidationError";
  }
}

type ConversationTarget = {
  chatId: string;
  sourceMessageId: string;
};

type ReplyConversationRow = Pick<ConversationRow, "id" | "hotel_id" | "guest_id" | "channel" | "status">;
type ReplyAttemptRow = Pick<
  MessageRow,
  | "id"
  | "hotel_id"
  | "conversation_id"
  | "guest_id"
  | "channel"
  | "direction"
  | "external_message_id"
  | "external_chat_id"
  | "sender_external_id"
  | "text_body"
  | "source_draft_id"
  | "sent_by_hotel_user_id"
  | "delivery_status"
  | "send_operation_key"
  | "delivered_at"
  | "raw_payload"
  | "created_at"
>;

function normalizeReplyText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function previewReplyText(textBody: string) {
  return textBody.length > 160 ? `${textBody.slice(0, 157)}...` : textBody;
}

function createPendingExternalMessageId(operationKey: string) {
  return `pending:${operationKey}`;
}

function buildTelegramExternalMessageId(chatId: string, telegramMessageId: number) {
  return `${chatId}:${telegramMessageId}`;
}

function buildFailurePayload(errorMessage: string, failureType: "retryable" | "ambiguous", operationKey: string): Json {
  return {
    operationKey,
    failureType,
    errorMessage,
  };
}

function validateOperationKey(operationKey: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationKey);
}

function mapPersistedAttemptToResult(attempt: ReplyAttemptRow): SendConversationReplyResult {
  if (attempt.delivery_status === "sent" && attempt.delivered_at) {
    return {
      outcome: "sent",
      messageId: attempt.id,
      conversationId: attempt.conversation_id,
      sourceDraftId: attempt.source_draft_id,
      deliveredAt: attempt.delivered_at,
    };
  }

  if (attempt.delivery_status === "failed_retryable") {
    return {
      outcome: "failed",
      failureType: "retryable",
      message: "The previous send attempt failed before Telegram confirmed delivery.",
      persistedAttemptId: attempt.id,
    };
  }

  return {
    outcome: "failed",
    failureType: "ambiguous",
    message: "This reply is already being processed or its delivery outcome could not be confirmed.",
    persistedAttemptId: attempt.id,
  };
}

export function classifyOutboundSendFailure(error: unknown) {
  if (error instanceof ReplyValidationError) {
    return {
      failureType: "retryable" as const,
      message: error.message,
    };
  }

  if (error instanceof TelegramIntegrationUnavailableError) {
    return {
      failureType: "retryable" as const,
      message: error.message,
    };
  }

  if (error instanceof TelegramSendMessageError) {
    return {
      failureType: error.kind === "rejected" ? ("retryable" as const) : ("ambiguous" as const),
      message: error.message,
    };
  }

  return {
    failureType: "ambiguous" as const,
    message: "Delivery outcome could not be confirmed. Verify with the guest before retrying.",
  };
}

function validateReplyBody(replyText: string) {
  const normalized = normalizeReplyText(replyText);
  if (!normalized) {
    throw new ReplyValidationError("Write a reply before sending.");
  }

  if (normalized.length > TELEGRAM_TEXT_LIMIT) {
    throw new ReplyValidationError("Reply text exceeds the Telegram text limit for Phase 1.");
  }

  return normalized;
}

async function ensureReplyActor(
  supabase: ReplyServiceSupabaseClient,
  hotelId: string,
  actorHotelUserId: string,
): Promise<Pick<HotelUserRow, "id" | "role">> {
  const { data, error } = await supabase
    .from("hotel_users")
    .select("id, role")
    .eq("hotel_id", hotelId)
    .eq("id", actorHotelUserId)
    .eq("is_active", true)
    .in("role", ["hotel_admin", "manager"])
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const actor = (data as Pick<HotelUserRow, "id" | "role"> | null) ?? null;
  if (!actor) {
    throw new ReplyValidationError("Only active hotel staff can send replies from this workspace.");
  }

  return actor;
}

async function getConversationForReply(
  supabase: ReplyServiceSupabaseClient,
  hotelId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, hotel_id, guest_id, channel, status")
    .eq("hotel_id", hotelId)
    .eq("id", conversationId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const conversation = (data as ReplyConversationRow | null) ?? null;
  if (!conversation) {
    throw new ReplyValidationError("This conversation is not available in the current hotel workspace.");
  }

  return conversation;
}

async function getDraftForConversation(
  supabase: ReplyServiceSupabaseClient,
  hotelId: string,
  conversationId: string,
  draftId: string,
) {
  const { data, error } = await supabase
    .from("ai_drafts")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", conversationId)
    .eq("id", draftId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AiDraftRow | null) ?? null;
}

async function getPersistedAttemptByOperationKey(
  supabase: ReplyServiceSupabaseClient,
  hotelId: string,
  operationKey: string,
) {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, hotel_id, conversation_id, guest_id, channel, direction, external_message_id, external_chat_id, sender_external_id, text_body, source_draft_id, sent_by_hotel_user_id, delivery_status, send_operation_key, delivered_at, raw_payload, created_at",
    )
    .eq("hotel_id", hotelId)
    .eq("send_operation_key", operationKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ReplyAttemptRow | null) ?? null;
}

export async function resolveConversationOutboundTargetWithClient(
  supabase: ReplyServiceSupabaseClient,
  hotelId: string,
  conversationId: string,
): Promise<ConversationTarget | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, external_chat_id")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const target = (data as { id: string; external_chat_id: string } | null) ?? null;
  if (!target?.external_chat_id) {
    return null;
  }

  return {
    chatId: target.external_chat_id,
    sourceMessageId: target.id,
  };
}

async function createReplyAttempt(
  supabase: ReplyServiceSupabaseClient,
  input: {
    hotelId: string;
    conversation: ReplyConversationRow;
    target: ConversationTarget;
    replyText: string;
    selectedDraftId: string | null;
    actorHotelUserId: string;
    operationKey: string;
  },
) {
  const { data, error } = await supabase
    .from("messages")
    .insert(
      {
        hotel_id: input.hotelId,
        conversation_id: input.conversation.id,
        guest_id: input.conversation.guest_id,
        channel: "telegram",
        direction: "outbound",
        message_type: "text",
        external_message_id: createPendingExternalMessageId(input.operationKey),
        external_chat_id: input.target.chatId,
        sender_external_id: null,
        text_body: input.replyText,
        source_draft_id: input.selectedDraftId,
        sent_by_hotel_user_id: input.actorHotelUserId,
        delivery_status: "sending",
        send_operation_key: input.operationKey,
        raw_payload: {
          operationKey: input.operationKey,
          targetChatId: input.target.chatId,
          targetSourceMessageId: input.target.sourceMessageId,
        },
      } as never,
    )
    .select(
      "id, hotel_id, conversation_id, guest_id, channel, direction, external_message_id, external_chat_id, sender_external_id, text_body, source_draft_id, sent_by_hotel_user_id, delivery_status, send_operation_key, delivered_at, raw_payload, created_at",
    )
    .single();

  if (error) {
    const duplicateError = error as Error & { code?: string };
    if (duplicateError.code === "23505") {
      const existing = await getPersistedAttemptByOperationKey(supabase, input.hotelId, input.operationKey);
      if (existing) {
        return existing;
      }
    }

    throw error;
  }

  return data as ReplyAttemptRow;
}

async function updateReplyAttemptOutcome(
  supabase: ReplyServiceSupabaseClient,
  attemptId: string,
  outcome: {
    deliveryStatus: OutboundDeliveryStatus;
    externalMessageId?: string;
    deliveredAt?: string | null;
    rawPayload?: Json;
  },
) {
  const { error } = await supabase
    .from("messages")
    .update(
      {
        delivery_status: outcome.deliveryStatus,
        external_message_id: outcome.externalMessageId,
        delivered_at: outcome.deliveredAt ?? null,
        raw_payload: outcome.rawPayload,
      } as never,
    )
    .eq("id", attemptId);

  if (error) {
    throw error;
  }
}

async function updateConversationAfterSend(
  supabase: ReplyServiceSupabaseClient,
  conversationId: string,
  hotelId: string,
  replyText: string,
  deliveredAt: string,
) {
  const { error } = await supabase
    .from("conversations")
    .update(
      {
        last_message_preview: previewReplyText(replyText),
        last_message_at: deliveredAt,
        status: "open",
      } as never,
    )
    .eq("hotel_id", hotelId)
    .eq("id", conversationId);

  if (error) {
    throw error;
  }
}

async function updateLatestDraftSelectionState(
  supabase: ReplyServiceSupabaseClient,
  input: {
    hotelId: string;
    conversationId: string;
    draftId: string | null;
    nextStatusForSelected: AiDraftRow["status"];
  },
) {
  const latestDrafts = await listLatestConversationDraftsWithClient(supabase, input.hotelId, input.conversationId);
  if (latestDrafts.length === 0) {
    return;
  }

  const visibleDraftIds = latestDrafts.map((draft) => draft.id);
  const selectedDraftId = input.draftId && visibleDraftIds.includes(input.draftId) ? input.draftId : null;
  const idsToReset = latestDrafts
    .filter((draft) => draft.id !== selectedDraftId && draft.status === "selected")
    .map((draft) => draft.id);

  if (idsToReset.length > 0) {
    const { error } = await supabase
      .from("ai_drafts")
      .update({ status: "generated" } as never)
      .eq("hotel_id", input.hotelId)
      .eq("conversation_id", input.conversationId)
      .in("id", idsToReset);

    if (error) {
      throw error;
    }
  }

  if (selectedDraftId) {
    const { error } = await supabase
      .from("ai_drafts")
      .update({ status: input.nextStatusForSelected } as never)
      .eq("hotel_id", input.hotelId)
      .eq("conversation_id", input.conversationId)
      .eq("id", selectedDraftId);

    if (error) {
      throw error;
    }
  }
}

export async function clearConversationDraftSelectionWithClient(
  supabase: ReplyServiceSupabaseClient,
  input: { hotelId: string; conversationId: string; actorHotelUserId: string },
) {
  await ensureReplyActor(supabase, input.hotelId, input.actorHotelUserId);
  await getConversationForReply(supabase, input.hotelId, input.conversationId);
  await updateLatestDraftSelectionState(supabase, {
    hotelId: input.hotelId,
    conversationId: input.conversationId,
    draftId: null,
    nextStatusForSelected: "generated",
  });
}

export async function clearConversationDraftSelection(input: {
  hotelId: string;
  conversationId: string;
  actorHotelUserId: string;
}) {
  const supabase = createServiceRoleSupabaseClient();
  return clearConversationDraftSelectionWithClient(supabase, input);
}

export async function selectConversationDraftWithClient(
  supabase: ReplyServiceSupabaseClient,
  input: { hotelId: string; conversationId: string; draftId: string; actorHotelUserId: string },
): Promise<SelectConversationDraftResult> {
  try {
    await ensureReplyActor(supabase, input.hotelId, input.actorHotelUserId);
    await getConversationForReply(supabase, input.hotelId, input.conversationId);
    const latestDrafts = await listLatestConversationDraftsWithClient(supabase, input.hotelId, input.conversationId);
    const selectedDraft = latestDrafts.find((draft) => draft.id === input.draftId) ?? null;

    if (!selectedDraft) {
      return {
        ok: false,
        errorCode: "not_found",
        errorMessage: "That draft is no longer available in this conversation.",
      };
    }

    if (selectedDraft.status === "sent") {
      return {
        ok: false,
        errorCode: "not_found",
        errorMessage: "That draft has already been used for a sent reply.",
      };
    }

    await updateLatestDraftSelectionState(supabase, {
      hotelId: input.hotelId,
      conversationId: input.conversationId,
      draftId: input.draftId,
      nextStatusForSelected: "selected",
    });
    await createEventLogSafely({
      hotelId: input.hotelId,
      entityType: "conversation",
      entityId: input.conversationId,
      eventType: "conversation_draft_selected",
      payload: {
        actorHotelUserId: input.actorHotelUserId,
        draftId: input.draftId,
      },
    });

    return {
      ok: true,
      draftId: selectedDraft.id,
      draftText: selectedDraft.draftText,
    };
  } catch (error) {
    if (error instanceof ReplyValidationError) {
      return {
        ok: false,
        errorCode: "invalid_actor",
        errorMessage: error.message,
      };
    }

    throw error;
  }
}

export async function selectConversationDraft(input: {
  hotelId: string;
  conversationId: string;
  draftId: string;
  actorHotelUserId: string;
}) {
  const supabase = createServiceRoleSupabaseClient();
  return selectConversationDraftWithClient(supabase, input);
}

export async function getConversationReplySupport(
  hotelId: string,
  conversationId: string,
): Promise<ConversationReplySupport> {
  const supabase = createServiceRoleSupabaseClient();
  const [integration, target] = await Promise.all([
    getActiveTelegramIntegration(hotelId),
    resolveConversationOutboundTargetWithClient(supabase, hotelId, conversationId),
  ]);

  if (!integration) {
    return {
      hasActiveTelegramIntegration: false,
      hasResolvableTarget: Boolean(target),
      disabledReason: "Reply sending is unavailable until an active Telegram integration is configured.",
    };
  }

  if (!target) {
    return {
      hasActiveTelegramIntegration: true,
      hasResolvableTarget: false,
      disabledReason: "This conversation does not yet have a trusted Telegram target for replies.",
    };
  }

  return {
    hasActiveTelegramIntegration: true,
    hasResolvableTarget: true,
    disabledReason: null,
  };
}

export async function sendConversationReplyWithClient(
  supabase: ReplyServiceSupabaseClient,
  input: SendConversationReplyInput,
): Promise<SendConversationReplyResult> {
  const selectedDraftId = input.selectedDraftId?.trim() || null;
  const replyText = validateReplyBody(input.replyText);

  if (!validateOperationKey(input.operationKey)) {
    throw new ReplyValidationError("The reply send token is invalid. Refresh the workspace and try again.");
  }

  await ensureReplyActor(supabase, input.hotelId, input.actorHotelUserId);
  const existingAttempt = await getPersistedAttemptByOperationKey(supabase, input.hotelId, input.operationKey);
  if (existingAttempt) {
    return mapPersistedAttemptToResult(existingAttempt);
  }

  const conversation = await getConversationForReply(supabase, input.hotelId, input.conversationId);
  const target = await resolveConversationOutboundTargetWithClient(supabase, input.hotelId, input.conversationId);
  if (!target) {
    throw new ReplyValidationError("This conversation does not have a Telegram target yet.");
  }

  if (selectedDraftId) {
    const selectedDraft = await getDraftForConversation(supabase, input.hotelId, input.conversationId, selectedDraftId);
    if (!selectedDraft || selectedDraft.status === "discarded" || selectedDraft.status === "sent") {
      throw new ReplyValidationError("The selected draft is not available for sending.");
    }
  }

  const attempt = await createReplyAttempt(supabase, {
    hotelId: input.hotelId,
    conversation,
    target,
    replyText,
    selectedDraftId,
    actorHotelUserId: input.actorHotelUserId,
    operationKey: input.operationKey,
  });

  if (attempt.delivery_status !== "sending") {
    return mapPersistedAttemptToResult(attempt);
  }

  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: "conversation",
    entityId: input.conversationId,
    eventType: "outbound_reply_send_requested",
    payload: {
      actorHotelUserId: input.actorHotelUserId,
      sourceDraftId: selectedDraftId,
      operationKey: input.operationKey,
      source: selectedDraftId ? "draft" : "manual",
    },
  });

  try {
    const telegramConfig = await getTelegramClientConfig({ hotelId: input.hotelId });
    const telegramResult = await sendTelegramTextMessage(telegramConfig, {
      chatId: target.chatId,
      text: replyText,
    });
    const deliveredAt = new Date().toISOString();
    await updateReplyAttemptOutcome(supabase, attempt.id, {
      deliveryStatus: "sent",
      externalMessageId: buildTelegramExternalMessageId(target.chatId, telegramResult.telegramMessageId),
      deliveredAt,
      rawPayload: {
        operationKey: input.operationKey,
        telegramMessageId: telegramResult.telegramMessageId,
        targetChatId: target.chatId,
      },
    });
    await updateConversationAfterSend(supabase, input.conversationId, input.hotelId, replyText, deliveredAt);
    await updateLatestDraftSelectionState(supabase, {
      hotelId: input.hotelId,
      conversationId: input.conversationId,
      draftId: selectedDraftId,
      nextStatusForSelected: "sent",
    });
    await createEventLogSafely({
      hotelId: input.hotelId,
      integrationId: telegramConfig.integrationId,
      entityType: "message",
      entityId: attempt.id,
      eventType: "outbound_reply_sent",
      payload: {
        actorHotelUserId: input.actorHotelUserId,
        conversationId: input.conversationId,
        sourceDraftId: selectedDraftId,
        operationKey: input.operationKey,
        source: selectedDraftId ? "draft" : "manual",
      },
    });

    return {
      outcome: "sent",
      messageId: attempt.id,
      conversationId: input.conversationId,
      sourceDraftId: selectedDraftId,
      deliveredAt,
    };
  } catch (error) {
    const failure = classifyOutboundSendFailure(error);
    await updateReplyAttemptOutcome(supabase, attempt.id, {
      deliveryStatus: failure.failureType === "retryable" ? "failed_retryable" : "failed_ambiguous",
      externalMessageId: attempt.external_message_id,
      deliveredAt: null,
      rawPayload: buildFailurePayload(failure.message, failure.failureType, input.operationKey),
    });
    await createEventLogSafely({
      hotelId: input.hotelId,
      entityType: "message",
      entityId: attempt.id,
      eventType: "outbound_reply_failed",
      payload: {
        actorHotelUserId: input.actorHotelUserId,
        conversationId: input.conversationId,
        sourceDraftId: selectedDraftId,
        operationKey: input.operationKey,
        source: selectedDraftId ? "draft" : "manual",
        failureType: failure.failureType,
        message: failure.message,
      },
    });

    return {
      outcome: "failed",
      failureType: failure.failureType,
      message: failure.message,
      persistedAttemptId: attempt.id,
    };
  }
}

export async function sendConversationReply(input: SendConversationReplyInput) {
  const supabase = createServiceRoleSupabaseClient();
  return sendConversationReplyWithClient(supabase, input);
}
