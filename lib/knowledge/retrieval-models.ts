import type { Database } from "@/types/database";

type FaqItemRow = Database["public"]["Tables"]["faq_items"]["Row"];
type PolicyItemRow = Database["public"]["Tables"]["policy_items"]["Row"];

export type RetrievalReason = "policy_precedence" | "direct_match" | "supporting_match";
export type RetrievalStatus = "evidence_found" | "insufficient_evidence" | "no_relevant_evidence";
export type RetrievalGuidanceMode = "answer_from_evidence" | "clarify_or_escalate";

export type RetrieveKnowledgeInput = {
  hotelId: string;
  conversationId: string;
  messageId: string;
  messageText: string;
  maxEvidenceItems?: number;
};

export type RetrievalEvidenceRef = {
  itemType: "faq" | "policy";
  itemId: string;
  hotelId: string;
  title: string;
  excerpt: string;
  score: number;
  retrievalReason: RetrievalReason;
};

export type RetrievalResult = {
  status: RetrievalStatus;
  guidanceMode: RetrievalGuidanceMode;
  evidence: RetrievalEvidenceRef[];
};

export type KnowledgeRetrievalCandidate = {
  itemType: "faq" | "policy";
  itemId: string;
  hotelId: string;
  title: string;
  body: string;
  publishedAt: string;
  updatedAt: string;
  searchableText: string;
};

export const DEFAULT_RETRIEVAL_EVIDENCE_LIMIT = 3;

function normalizeRetrievalText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createSearchableText(title: string, body: string) {
  return normalizeRetrievalText(`${title} ${body}`);
}

export function createFaqRetrievalCandidate(row: FaqItemRow): KnowledgeRetrievalCandidate {
  return {
    itemType: "faq",
    itemId: row.id,
    hotelId: row.hotel_id,
    title: row.question,
    body: row.answer,
    publishedAt: row.published_at ?? row.updated_at,
    updatedAt: row.updated_at,
    searchableText: createSearchableText(row.question, row.answer),
  };
}

export function createPolicyRetrievalCandidate(row: PolicyItemRow): KnowledgeRetrievalCandidate {
  return {
    itemType: "policy",
    itemId: row.id,
    hotelId: row.hotel_id,
    title: row.title,
    body: row.body,
    publishedAt: row.published_at ?? row.updated_at,
    updatedAt: row.updated_at,
    searchableText: createSearchableText(row.title, row.body),
  };
}

export function createRetrievalResult(
  status: RetrievalStatus,
  evidence: RetrievalEvidenceRef[] = [],
): RetrievalResult {
  return {
    status,
    guidanceMode: status === "evidence_found" ? "answer_from_evidence" : "clarify_or_escalate",
    evidence,
  };
}
