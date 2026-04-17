import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { createEventLogSafely } from "@/lib/events/event-logs";
import {
  DEFAULT_RETRIEVAL_EVIDENCE_LIMIT,
  createCompactEvidenceSummaries,
  createRetrievalHandoffContract,
  createFaqRetrievalCandidate,
  createPolicyRetrievalCandidate,
  rankKnowledgeEvidence,
  type RetrieveKnowledgeInput,
  type KnowledgeRetrievalCandidate,
} from "@/lib/knowledge/retrieval-models";

type KnowledgeSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type FaqItemRow = Database["public"]["Tables"]["faq_items"]["Row"];
type PolicyItemRow = Database["public"]["Tables"]["policy_items"]["Row"];

async function listPublishedKnowledgeCandidatesWithClient(
  supabase: KnowledgeSupabaseClient,
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

export async function listPublishedFaqCandidatesWithClient(supabase: KnowledgeSupabaseClient, hotelId: string) {
  return listPublishedKnowledgeCandidatesWithClient(supabase, hotelId, "faq");
}

export async function listPublishedFaqCandidates(hotelId: string) {
  const supabase = await createServerSupabaseClient();
  return listPublishedFaqCandidatesWithClient(supabase, hotelId);
}

export async function listPublishedPolicyCandidatesWithClient(supabase: KnowledgeSupabaseClient, hotelId: string) {
  return listPublishedKnowledgeCandidatesWithClient(supabase, hotelId, "policy");
}

export async function listPublishedPolicyCandidates(hotelId: string) {
  const supabase = await createServerSupabaseClient();
  return listPublishedPolicyCandidatesWithClient(supabase, hotelId);
}

export async function retrieveKnowledgeWithClient(
  supabase: KnowledgeSupabaseClient,
  input: RetrieveKnowledgeInput,
) {
  const [policyCandidates, faqCandidates] = await Promise.all([
    listPublishedPolicyCandidatesWithClient(supabase, input.hotelId),
    listPublishedFaqCandidatesWithClient(supabase, input.hotelId),
  ]);

  return rankKnowledgeEvidence(
    input.messageText,
    [...policyCandidates, ...faqCandidates],
    input.maxEvidenceItems ?? DEFAULT_RETRIEVAL_EVIDENCE_LIMIT,
  );
}

export async function retrieveKnowledge(input: RetrieveKnowledgeInput) {
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

  const supabase = await createServerSupabaseClient();
  const result = await retrieveKnowledgeWithClient(supabase, input);
  const handoff = createRetrievalHandoffContract(result);

  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: "conversation",
    entityId: input.conversationId,
    eventType: "kb_retrieval_completed",
    payload: {
      messageId: input.messageId,
      retrievalStatus: handoff.retrievalStatus,
      guidanceMode: handoff.guidanceMode,
      evidenceCount: handoff.evidenceRefs.length,
      evidenceSummary: createCompactEvidenceSummaries(handoff.evidenceRefs),
    },
  });

  return result;
}
