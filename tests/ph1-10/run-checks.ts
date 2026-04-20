import assert from "node:assert/strict";
import {
  PHASE1_AUDIT_EVENT_REQUIRED_PAYLOAD_KEYS,
  PHASE1_AUDIT_EVENT_TYPES,
  compactAuditPayload,
  isPhase1AuditEventType,
} from "../../lib/events/catalog.ts";
import {
  PHASE1_ACCEPTANCE_MATRIX,
  formatPhase1ReleaseResult,
  getPrimaryAutomationSource,
  summarizePhase1ReleaseChecks,
} from "../../lib/events/release-matrix.ts";

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

  assert.equal(PHASE1_ACCEPTANCE_MATRIX.length >= 10, true);
  assert.equal(PHASE1_ACCEPTANCE_MATRIX.some((entry) => entry.key === "tenant_safe_hotel_access"), true);
  assert.equal(PHASE1_ACCEPTANCE_MATRIX.some((entry) => entry.key === "outbound_failure_handling"), true);
  assert.equal(
    getPrimaryAutomationSource(
      PHASE1_ACCEPTANCE_MATRIX.find((entry) => entry.key === "human_approved_outbound_send")!,
    )?.scriptName,
    "verify:ph1-09",
  );
  assert.equal(
    summarizePhase1ReleaseChecks([
      { key: "one", criterion: "Criterion one", ownerSpec: "PH1-03", status: "pass", evidence: "ok" },
      { key: "two", criterion: "Criterion two", ownerSpec: "PH1-10", status: "manual", evidence: "LOCAL_SETUP.md" },
    ]).outcome,
    "pass",
  );
  assert.equal(
    formatPhase1ReleaseResult(
      summarizePhase1ReleaseChecks([
        { key: "broken", criterion: "Broken criterion", ownerSpec: "PH1-09", status: "fail", evidence: "verify:ph1-09 failed" },
      ]),
    ).includes("[fail] broken (PH1-09)"),
    true,
  );

  console.log("PH1-10 helper checks passed.");
} catch (error) {
  console.error("PH1-10 helper checks failed.");
  throw error;
}
