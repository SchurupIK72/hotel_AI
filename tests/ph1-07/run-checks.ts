import assert from "node:assert/strict";
import {
  DEFAULT_RETRIEVAL_EVIDENCE_LIMIT,
  createFaqRetrievalCandidate,
  createPolicyRetrievalCandidate,
  createRetrievalResult,
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

  console.log("PH1-07 helper checks passed.");
} catch (error) {
  console.error("PH1-07 helper checks failed.");
  throw error;
}
