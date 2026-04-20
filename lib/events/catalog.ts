import type { Json } from "../../types/database.ts";

export const PHASE1_AUDIT_EVENT_TYPES = [
  "telegram_webhook_received",
  "telegram_webhook_rejected",
  "telegram_webhook_ignored",
  "message_inbound_saved",
  "message_inbound_deduplicated",
  "guest_created",
  "guest_resolved",
  "conversation_created",
  "conversation_resolved",
  "conversation_operation_rejected",
  "conversation_status_changed",
  "conversation_assigned",
  "conversation_unassigned",
  "conversation_unread_cleared",
  "kb_retrieval_requested",
  "kb_retrieval_completed",
  "ai_drafts_generated",
  "ai_drafts_suppressed",
  "ai_drafts_generation_failed",
  "conversation_draft_selected",
  "outbound_reply_send_requested",
  "outbound_reply_sent",
  "outbound_reply_failed",
  "faq_operation_rejected",
  "faq_created",
  "faq_updated",
  "faq_deleted",
  "faq_published",
  "faq_unpublished",
  "policy_operation_rejected",
  "policy_created",
  "policy_updated",
  "policy_deleted",
  "policy_published",
  "policy_unpublished",
] as const;

export type Phase1AuditEventType = (typeof PHASE1_AUDIT_EVENT_TYPES)[number];

export const PHASE1_AUDIT_EVENT_REQUIRED_PAYLOAD_KEYS: Partial<Record<Phase1AuditEventType, string[]>> = {
  conversation_status_changed: ["actorHotelUserId", "nextStatus"],
  conversation_assigned: ["actorHotelUserId", "assignedHotelUserId"],
  conversation_unassigned: ["actorHotelUserId", "assignedHotelUserId"],
  kb_retrieval_requested: ["messageId"],
  kb_retrieval_completed: ["messageId", "retrievalStatus"],
  ai_drafts_generated: ["messageId", "trigger", "retrievalStatus", "draftCount", "modelName"],
  ai_drafts_suppressed: ["messageId", "trigger", "reason", "retrievalStatus"],
  conversation_draft_selected: ["actorHotelUserId", "conversationId", "draftId"],
  outbound_reply_send_requested: ["actorHotelUserId", "conversationId", "messageId", "operationKey", "source"],
  outbound_reply_sent: ["actorHotelUserId", "conversationId", "messageId", "operationKey", "source"],
  outbound_reply_failed: ["actorHotelUserId", "conversationId", "messageId", "operationKey", "source", "failureType"],
};

export function isPhase1AuditEventType(value: string): value is Phase1AuditEventType {
  return PHASE1_AUDIT_EVENT_TYPES.includes(value as Phase1AuditEventType);
}

export function compactAuditPayload(input: Record<string, Json | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Record<string, Json>;
}
