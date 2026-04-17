import assert from "node:assert/strict";
import {
  KNOWLEDGE_ITEM_TYPES,
  createFaqKnowledgeListItem,
  createPolicyKnowledgeListItem,
} from "../../lib/knowledge/models.ts";

try {
  assert.deepEqual(KNOWLEDGE_ITEM_TYPES, ["faq", "policy"]);

  const faq = createFaqKnowledgeListItem({
    id: "faq-1",
    hotel_id: "hotel-1",
    question: "Do you offer breakfast?",
    answer: "Breakfast is served from 07:00 to 10:30.",
    is_published: false,
    published_at: null,
    created_by_hotel_user_id: "hotel-user-1",
    updated_by_hotel_user_id: "hotel-user-2",
    created_at: "2026-04-17T10:00:00.000Z",
    updated_at: "2026-04-17T11:00:00.000Z",
  });
  assert.equal(faq.type, "faq");
  assert.equal(faq.title, "Do you offer breakfast?");
  assert.equal(faq.publishState, "draft");

  const policy = createPolicyKnowledgeListItem({
    id: "policy-1",
    hotel_id: "hotel-1",
    title: "Late checkout",
    body: "Late checkout is subject to availability.",
    is_published: true,
    published_at: "2026-04-17T12:00:00.000Z",
    created_by_hotel_user_id: "hotel-user-1",
    updated_by_hotel_user_id: "hotel-user-1",
    created_at: "2026-04-17T09:00:00.000Z",
    updated_at: "2026-04-17T12:00:00.000Z",
  });
  assert.equal(policy.type, "policy");
  assert.equal(policy.title, "Late checkout");
  assert.equal(policy.publishState, "published");

  console.log("PH1-06 helper checks passed.");
} catch (error) {
  console.error("PH1-06 helper checks failed.");
  throw error;
}
