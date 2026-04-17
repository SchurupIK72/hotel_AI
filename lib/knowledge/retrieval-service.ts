import type { SupabaseClient } from "@supabase/supabase-js";
import { createEventLogSafely } from "../events/event-logs.ts";
import type { Database } from "../../types/database.ts";
import {
  DEFAULT_RETRIEVAL_EVIDENCE_LIMIT,
  createCompactEvidenceSummaries,
  createFaqRetrievalCandidate,
  createPolicyRetrievalCandidate,
  rankKnowledgeEvidence,
  type RetrieveKnowledgeInput,
} from "./retrieval-models.ts";

type RetrievalSupabaseClient = {
  from: SupabaseClient<Database>["from"];
};
type FaqItemRow = Database["public"]["Tables"]["faq_items"]["Row"];
type PolicyItemRow = Database["public"]["Tables"]["policy_items"]["Row"];

async function listPublishedKnowledgeCandidatesWithClient(
  supabase: RetrievalSupabaseClient,
  hotelId: string,
  itemType: "faq" | "policy",
) {
  const table = itemType === "faq" ? "faq_items" : "policy_items";
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return itemType === "faq"
    ? ((data ?? []) as FaqItemRow[]).map(createFaqRetrievalCandidate)
    : ((data ?? []) as PolicyItemRow[]).map(createPolicyRetrievalCandidate);
}

export async function listPublishedFaqCandidatesWithClient(supabase: RetrievalSupabaseClient, hotelId: string) {
  return listPublishedKnowledgeCandidatesWithClient(supabase, hotelId, "faq");
}

export async function listPublishedPolicyCandidatesWithClient(supabase: RetrievalSupabaseClient, hotelId: string) {
  return listPublishedKnowledgeCandidatesWithClient(supabase, hotelId, "policy");
}

export async function retrieveKnowledgeWithClient(
  supabase: RetrievalSupabaseClient,
  input: RetrieveKnowledgeInput,
) {
  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: "conversation",
    entityId: input.conversationId,
    eventType: "kb_retrieval_requested",
    payload: {
      messageId: input.messageId,
      requestedEvidenceLimit: input.maxEvidenceItems ?? DEFAULT_RETRIEVAL_EVIDENCE_LIMIT,
    },
  });

  const [policyCandidates, faqCandidates] = await Promise.all([
    listPublishedPolicyCandidatesWithClient(supabase, input.hotelId),
    listPublishedFaqCandidatesWithClient(supabase, input.hotelId),
  ]);

  const result = rankKnowledgeEvidence(
    input.messageText,
    [...policyCandidates, ...faqCandidates],
    input.maxEvidenceItems ?? DEFAULT_RETRIEVAL_EVIDENCE_LIMIT,
  );

  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: "conversation",
    entityId: input.conversationId,
    eventType: "kb_retrieval_completed",
    payload: {
      messageId: input.messageId,
      retrievalStatus: result.status,
      guidanceMode: result.guidanceMode,
      evidenceCount: result.evidence.length,
      evidenceSummary: createCompactEvidenceSummaries(result.evidence),
    },
  });

  return result;
}
