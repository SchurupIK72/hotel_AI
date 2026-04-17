import assert from "node:assert/strict";
import { AI_DRAFT_SOURCE_TYPES, AI_DRAFT_STATUSES, selectLatestDraftGeneration } from "../../lib/copilot/models.ts";
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

  console.log("PH1-08 helper checks passed.");
} catch (error) {
  console.error("PH1-08 helper checks failed.");
  throw error;
}
