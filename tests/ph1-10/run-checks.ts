import assert from "node:assert/strict";
import {
  PHASE1_AUDIT_EVENT_REQUIRED_PAYLOAD_KEYS,
  PHASE1_AUDIT_EVENT_TYPES,
  compactAuditPayload,
  isPhase1AuditEventType,
} from "../../lib/events/catalog.ts";

try {
  for (const requiredEventType of [
    "telegram_webhook_received",
    "message_inbound_saved",
    "kb_retrieval_completed",
    "ai_drafts_generated",
    "conversation_draft_selected",
    "outbound_reply_send_requested",
    "outbound_reply_sent",
    "outbound_reply_failed",
  ]) {
    assert.equal(isPhase1AuditEventType(requiredEventType), true);
  }

  assert.equal(isPhase1AuditEventType("not_a_real_event"), false);
  assert.equal(PHASE1_AUDIT_EVENT_TYPES.includes("conversation_status_changed"), true);
  assert.deepEqual(PHASE1_AUDIT_EVENT_REQUIRED_PAYLOAD_KEYS.conversation_draft_selected, [
    "actorHotelUserId",
    "conversationId",
    "draftId",
  ]);
  assert.deepEqual(PHASE1_AUDIT_EVENT_REQUIRED_PAYLOAD_KEYS.outbound_reply_failed, [
    "actorHotelUserId",
    "conversationId",
    "messageId",
    "operationKey",
    "source",
    "failureType",
  ]);

  assert.deepEqual(
    compactAuditPayload({
      actorHotelUserId: "hotel-user-1",
      conversationId: "conversation-1",
      sourceDraftId: undefined,
      operationKey: "operation-1",
    }),
    {
      actorHotelUserId: "hotel-user-1",
      conversationId: "conversation-1",
      operationKey: "operation-1",
    },
  );

  console.log("PH1-10 helper checks passed.");
} catch (error) {
  console.error("PH1-10 helper checks failed.");
  throw error;
}
