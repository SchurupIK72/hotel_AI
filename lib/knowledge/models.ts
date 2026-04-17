import type { Database } from "@/types/database";

type FaqItemRow = Database["public"]["Tables"]["faq_items"]["Row"];
type PolicyItemRow = Database["public"]["Tables"]["policy_items"]["Row"];

export const KNOWLEDGE_ITEM_TYPES = ["faq", "policy"] as const;
export type KnowledgeItemType = (typeof KNOWLEDGE_ITEM_TYPES)[number];

export type KnowledgePublishState = "draft" | "published";

export type KnowledgeListItem = {
  id: string;
  hotelId: string;
  type: KnowledgeItemType;
  title: string;
  body: string;
  publishState: KnowledgePublishState;
  publishedAt: string | null;
  createdByHotelUserId: string;
  updatedByHotelUserId: string;
  createdAt: string;
  updatedAt: string;
};

function resolvePublishState(isPublished: boolean): KnowledgePublishState {
  return isPublished ? "published" : "draft";
}

export function createFaqKnowledgeListItem(row: FaqItemRow): KnowledgeListItem {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    type: "faq",
    title: row.question,
    body: row.answer,
    publishState: resolvePublishState(row.is_published),
    publishedAt: row.published_at,
    createdByHotelUserId: row.created_by_hotel_user_id,
    updatedByHotelUserId: row.updated_by_hotel_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPolicyKnowledgeListItem(row: PolicyItemRow): KnowledgeListItem {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    type: "policy",
    title: row.title,
    body: row.body,
    publishState: resolvePublishState(row.is_published),
    publishedAt: row.published_at,
    createdByHotelUserId: row.created_by_hotel_user_id,
    updatedByHotelUserId: row.updated_by_hotel_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
