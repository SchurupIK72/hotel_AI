import type { Database } from "@/types/database";

type AiDraftRow = Database["public"]["Tables"]["ai_drafts"]["Row"];

export const AI_DRAFT_SOURCE_TYPES = ["kb", "fallback", "manual_trigger"] as const;
export const AI_DRAFT_STATUSES = ["generated", "selected", "sent", "discarded"] as const;

export type StoredConversationDraft = {
  id: string;
  generationId: string;
  hotelId: string;
  conversationId: string;
  messageId: string;
  draftIndex: number;
  draftText: string;
  sourceType: AiDraftRow["source_type"];
  status: AiDraftRow["status"];
  retrievalRefs: AiDraftRow["retrieval_refs"];
  modelName: string | null;
  confidenceLabel: string | null;
  createdAt: string;
};

export function createStoredConversationDraft(row: AiDraftRow): StoredConversationDraft {
  return {
    id: row.id,
    generationId: row.generation_id,
    hotelId: row.hotel_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    draftIndex: row.draft_index,
    draftText: row.draft_text,
    sourceType: row.source_type,
    status: row.status,
    retrievalRefs: row.retrieval_refs,
    modelName: row.model_name,
    confidenceLabel: row.confidence_label,
    createdAt: row.created_at,
  };
}

export function selectLatestDraftGeneration(rows: AiDraftRow[]) {
  const drafts = rows.map(createStoredConversationDraft);
  const latestGenerationId = drafts[0]?.generationId;
  if (!latestGenerationId) {
    return [];
  }

  return drafts
    .filter((draft) => draft.generationId === latestGenerationId)
    .sort((left, right) => left.draftIndex - right.draftIndex);
}
