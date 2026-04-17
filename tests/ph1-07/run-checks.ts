import assert from "node:assert/strict";
import {
  DEFAULT_RETRIEVAL_EVIDENCE_LIMIT,
  createRetrievalEvidenceRef,
  createFaqRetrievalCandidate,
  createPolicyRetrievalCandidate,
  createRetrievalResult,
  rankKnowledgeEvidence,
  tokenizeRetrievalQuery,
} from "../../lib/knowledge/retrieval-models.ts";

try {
  assert.equal(DEFAULT_RETRIEVAL_EVIDENCE_LIMIT, 3);

  const faqCandidate = createFaqRetrievalCandidate({
    id: "faq-1",
    hotel_id: "hotel-1",
    question: "Do you offer breakfast?",
    answer: "Breakfast is served from 07:00 to 10:30.",
    is_published: true,
    published_at: "2026-04-17T12:00:00.000Z",
    created_by_hotel_user_id: "hotel-user-1",
    updated_by_hotel_user_id: "hotel-user-2",
    created_at: "2026-04-17T10:00:00.000Z",
    updated_at: "2026-04-17T11:00:00.000Z",
  });
  assert.equal(faqCandidate.itemType, "faq");
  assert.equal(faqCandidate.title, "Do you offer breakfast?");
  assert.equal(faqCandidate.publishedAt, "2026-04-17T12:00:00.000Z");
  assert.equal(faqCandidate.searchableText, "do you offer breakfast? breakfast is served from 07:00 to 10:30.");

  const policyCandidate = createPolicyRetrievalCandidate({
    id: "policy-1",
    hotel_id: "hotel-1",
    title: "Late checkout",
    body: "Late checkout is subject to availability.",
    is_published: true,
    published_at: null,
    created_by_hotel_user_id: "hotel-user-1",
    updated_by_hotel_user_id: "hotel-user-1",
    created_at: "2026-04-17T09:00:00.000Z",
    updated_at: "2026-04-17T12:00:00.000Z",
  });
  assert.equal(policyCandidate.itemType, "policy");
  assert.equal(policyCandidate.publishedAt, "2026-04-17T12:00:00.000Z");
  assert.equal(policyCandidate.searchableText, "late checkout late checkout is subject to availability.");
  assert.deepEqual(tokenizeRetrievalQuery("  Need late checkout after breakfast! "), ["need", "late", "checkout", "after", "breakfast"]);

  const evidenceResult = createRetrievalResult("evidence_found", [
    {
      itemType: "policy",
      itemId: "policy-1",
      hotelId: "hotel-1",
      title: "Late checkout",
      excerpt: "Late checkout is subject to availability.",
      score: 0.92,
      retrievalReason: "policy_precedence",
    },
  ]);
  assert.equal(evidenceResult.guidanceMode, "answer_from_evidence");
  assert.equal(evidenceResult.evidence.length, 1);

  const fallbackResult = createRetrievalResult("no_relevant_evidence");
  assert.equal(fallbackResult.guidanceMode, "clarify_or_escalate");
  assert.deepEqual(fallbackResult.evidence, []);

  const evidenceRef = createRetrievalEvidenceRef(policyCandidate, 0.9234, "policy_precedence");
  assert.equal(evidenceRef.score, 0.923);
  assert.equal(evidenceRef.excerpt, "Late checkout is subject to availability.");

  const rankedResult = rankKnowledgeEvidence(
    "Can I request late checkout availability?",
    [
      faqCandidate,
      policyCandidate,
      {
        ...faqCandidate,
        itemId: "faq-2",
        title: "Late checkout request",
        body: "Late checkout can be requested at the front desk.",
        searchableText: "late checkout request late checkout can be requested at the front desk.",
      },
    ],
    2,
  );
  assert.equal(rankedResult.status, "evidence_found");
  assert.equal(rankedResult.evidence.length, 2);
  assert.equal(rankedResult.evidence[0]?.itemType, "policy");
  assert.equal(rankedResult.evidence[0]?.retrievalReason, "policy_precedence");

  const insufficientResult = rankKnowledgeEvidence(
    "Do you have breakfast and parking?",
    [faqCandidate],
    2,
  );
  assert.equal(insufficientResult.status, "insufficient_evidence");
  assert.equal(insufficientResult.guidanceMode, "clarify_or_escalate");
  assert.equal(insufficientResult.evidence.length, 1);

  const noEvidenceResult = rankKnowledgeEvidence(
    "Hi",
    [faqCandidate, policyCandidate],
    2,
  );
  assert.equal(noEvidenceResult.status, "no_relevant_evidence");
  assert.deepEqual(noEvidenceResult.evidence, []);

  console.log("PH1-07 helper checks passed.");
} catch (error) {
  console.error("PH1-07 helper checks failed.");
  throw error;
}
