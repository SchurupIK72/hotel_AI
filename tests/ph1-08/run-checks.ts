import assert from "node:assert/strict";
import { AI_DRAFT_SOURCE_TYPES, AI_DRAFT_STATUSES, selectLatestDraftGeneration } from "../../lib/copilot/models.ts";
import {
  createDraftVariantsFromContext,
  evaluateDraftGenerationSafety,
} from "../../lib/copilot/generation-models.ts";
import { createDraftPanelState } from "../../lib/conversations/models.ts";

try {
  assert.deepEqual(AI_DRAFT_SOURCE_TYPES, ["kb", "fallback", "manual_trigger"]);
  assert.deepEqual(AI_DRAFT_STATUSES, ["generated", "selected", "sent", "discarded"]);

  const latestDrafts = selectLatestDraftGeneration([
    {
      id: "draft-3",
      generation_id: "generation-2",
      hotel_id: "hotel-1",
      conversation_id: "conversation-1",
      message_id: "message-2",
      draft_index: 2,
      draft_text: "Alternative breakfast reply.",
      source_type: "kb",
      status: "generated",
      retrieval_refs: [],
      model_name: "gpt-phase1",
      confidence_label: "knowledge-backed",
      created_at: "2026-04-18T09:01:00.000Z",
    },
    {
      id: "draft-2",
      generation_id: "generation-2",
      hotel_id: "hotel-1",
      conversation_id: "conversation-1",
      message_id: "message-2",
      draft_index: 1,
      draft_text: "Breakfast is served from 07:00 to 10:30.",
      source_type: "kb",
      status: "generated",
      retrieval_refs: [],
      model_name: "gpt-phase1",
      confidence_label: "knowledge-backed",
      created_at: "2026-04-18T09:01:00.000Z",
    },
    {
      id: "draft-1",
      generation_id: "generation-1",
      hotel_id: "hotel-1",
      conversation_id: "conversation-1",
      message_id: "message-1",
      draft_index: 1,
      draft_text: "Older draft set.",
      source_type: "fallback",
      status: "generated",
      retrieval_refs: null,
      model_name: null,
      confidence_label: "clarification-needed",
      created_at: "2026-04-18T08:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    latestDrafts.map((draft) => [draft.generationId, draft.draftIndex, draft.id]),
    [
      ["generation-2", 1, "draft-2"],
      ["generation-2", 2, "draft-3"],
    ],
  );

  const readyPanel = createDraftPanelState({ drafts: latestDrafts, state: "empty" });
  assert.equal(readyPanel.state, "ready");
  assert.equal(readyPanel.title, "Latest AI drafts");
  assert.equal(readyPanel.drafts[0]?.label, "Draft 1");
  assert.equal(readyPanel.drafts[0]?.confidenceLabel, "knowledge-backed");
  assert.equal(readyPanel.drafts[1]?.sourceType, "kb");

  const knowledgeResult = createDraftVariantsFromContext("What time is breakfast served?", "auto_on_inbound", {
    status: "evidence_found",
    guidanceMode: "answer_from_evidence",
    evidence: [
      {
        itemType: "faq",
        itemId: "faq-1",
        hotelId: "hotel-1",
        title: "Breakfast",
        excerpt: "Breakfast is served daily from 07:00 to 10:30.",
        score: 0.9,
        retrievalReason: "direct_match",
      },
    ],
  });
  assert.equal(knowledgeResult.outcome, "generated");
  assert.equal(knowledgeResult.drafts.length, 3);
  assert.equal(knowledgeResult.drafts[0]?.sourceType, "kb");
  assert.equal(knowledgeResult.drafts[0]?.confidenceLabel, "knowledge-backed");

  const fallbackDecision = evaluateDraftGenerationSafety("Can you tell me more about breakfast?", {
    status: "no_relevant_evidence",
    guidanceMode: "clarify_or_escalate",
    evidence: [],
  });
  assert.deepEqual(fallbackDecision, { action: "generate", mode: "clarification_fallback" });

  const fallbackResult = createDraftVariantsFromContext("Can you tell me more about breakfast?", "manual_regenerate", {
    status: "insufficient_evidence",
    guidanceMode: "clarify_or_escalate",
    evidence: [],
  });
  assert.equal(fallbackResult.outcome, "generated");
  assert.equal(fallbackResult.drafts.length, 2);
  assert.equal(fallbackResult.drafts[0]?.sourceType, "manual_trigger");
  assert.equal(fallbackResult.drafts[0]?.confidenceLabel, "clarification-needed");

  const suppressedResult = createDraftVariantsFromContext("Can I get a refund and change my booking?", "auto_on_inbound", {
    status: "evidence_found",
    guidanceMode: "answer_from_evidence",
    evidence: [],
  });
  assert.deepEqual(suppressedResult, {
    outcome: "suppressed",
    reason: "unsupported_request",
    retrievalStatus: "evidence_found",
  });

  console.log("PH1-08 helper checks passed.");
} catch (error) {
  console.error("PH1-08 helper checks failed.");
  throw error;
}
