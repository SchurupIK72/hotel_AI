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

export type CompactRetrievalEvidenceSummary = {
  itemType: "faq" | "policy";
  itemId: string;
  title: string;
  score: number;
  retrievalReason: RetrievalReason;
};

export type RetrievalHandoffContract = {
  retrievalStatus: RetrievalStatus;
  guidanceMode: RetrievalGuidanceMode;
  evidenceRefs: RetrievalEvidenceRef[];
  evidenceSummary: CompactRetrievalEvidenceSummary[];
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
const MIN_QUERY_TOKEN_LENGTH = 3;
const EVIDENCE_FOUND_THRESHOLD = 0.5;
const INSUFFICIENT_EVIDENCE_THRESHOLD = 0.2;
const MIN_INCLUDED_EVIDENCE_SCORE = 0.18;
const POLICY_PRECEDENCE_EPSILON = 0.12;

function normalizeRetrievalText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function truncateExcerpt(value: string, maxLength = 220) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function createSearchableText(title: string, body: string) {
  return normalizeRetrievalText(`${title} ${body}`);
}

export function tokenizeRetrievalQuery(value: string) {
  const normalized = normalizeRetrievalText(value);
  return Array.from(
    new Set(
      normalized
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= MIN_QUERY_TOKEN_LENGTH),
    ),
  );
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

export function createRetrievalEvidenceRef(
  candidate: KnowledgeRetrievalCandidate,
  score: number,
  retrievalReason: RetrievalReason,
): RetrievalEvidenceRef {
  return {
    itemType: candidate.itemType,
    itemId: candidate.itemId,
    hotelId: candidate.hotelId,
    title: candidate.title,
    excerpt: truncateExcerpt(candidate.body),
    score: Number(score.toFixed(3)),
    retrievalReason,
  };
}

export function createCompactEvidenceSummaries(
  evidence: RetrievalEvidenceRef[],
): CompactRetrievalEvidenceSummary[] {
  return evidence.map((item) => ({
    itemType: item.itemType,
    itemId: item.itemId,
    title: item.title,
    score: item.score,
    retrievalReason: item.retrievalReason,
  }));
}

export function createRetrievalHandoffContract(
  result: RetrievalResult,
): RetrievalHandoffContract {
  return {
    retrievalStatus: result.status,
    guidanceMode: result.guidanceMode,
    evidenceRefs: result.evidence,
    evidenceSummary: createCompactEvidenceSummaries(result.evidence),
  };
}

function scoreCandidateMatch(queryTokens: string[], candidate: KnowledgeRetrievalCandidate) {
  if (queryTokens.length === 0) {
    return { score: 0, retrievalReason: "supporting_match" as RetrievalReason };
  }

  const titleText = candidate.title.toLowerCase();
  const bodyText = candidate.body.toLowerCase();
  const titleHits = queryTokens.filter((token) => titleText.includes(token)).length;
  const bodyHits = queryTokens.filter((token) => bodyText.includes(token)).length;
  const titleRatio = titleHits / queryTokens.length;
  const bodyRatio = bodyHits / queryTokens.length;
  const policyBonus = candidate.itemType === "policy" && titleHits + bodyHits > 0 ? 0.12 : 0;
  const score = Math.min(1, titleRatio * 0.65 + bodyRatio * 0.35 + policyBonus);

  return {
    score,
    retrievalReason:
      candidate.itemType === "policy" && score > 0
        ? ("policy_precedence" as RetrievalReason)
        : titleHits > 0
          ? ("direct_match" as RetrievalReason)
          : ("supporting_match" as RetrievalReason),
  };
}

export function rankKnowledgeEvidence(
  messageText: string,
  candidates: KnowledgeRetrievalCandidate[],
  maxEvidenceItems = DEFAULT_RETRIEVAL_EVIDENCE_LIMIT,
): RetrievalResult {
  const queryTokens = tokenizeRetrievalQuery(messageText);
  if (queryTokens.length === 0) {
    return createRetrievalResult("no_relevant_evidence");
  }

  const rankedEvidence = candidates
    .map((candidate) => {
      const ranking = scoreCandidateMatch(queryTokens, candidate);
      return {
        candidate,
        score: ranking.score,
        retrievalReason: ranking.retrievalReason,
      };
    })
    .filter((item) => item.score >= MIN_INCLUDED_EVIDENCE_SCORE)
    .sort((left, right) => {
      if (
        left.candidate.itemType !== right.candidate.itemType &&
        Math.abs(right.score - left.score) <= POLICY_PRECEDENCE_EPSILON
      ) {
        return left.candidate.itemType === "policy" ? -1 : 1;
      }
      if (right.score !== left.score) return right.score - left.score;
      if (left.candidate.itemType !== right.candidate.itemType) return left.candidate.itemType === "policy" ? -1 : 1;
      if (left.candidate.updatedAt !== right.candidate.updatedAt) {
        return right.candidate.updatedAt.localeCompare(left.candidate.updatedAt);
      }
      return left.candidate.itemId.localeCompare(right.candidate.itemId);
    })
    .slice(0, maxEvidenceItems)
    .map((item) => createRetrievalEvidenceRef(item.candidate, item.score, item.retrievalReason));

  if (rankedEvidence.length === 0) {
    return createRetrievalResult("no_relevant_evidence");
  }

  const strongestScore = rankedEvidence[0]?.score ?? 0;
  return createRetrievalResult(
    strongestScore >= EVIDENCE_FOUND_THRESHOLD
      ? "evidence_found"
      : strongestScore >= INSUFFICIENT_EVIDENCE_THRESHOLD
        ? "insufficient_evidence"
        : "no_relevant_evidence",
    strongestScore >= INSUFFICIENT_EVIDENCE_THRESHOLD ? rankedEvidence : [],
  );
}
