import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findActiveHotelUserById } from "@/lib/db/hotel-users";
import { createEventLogSafely } from "@/lib/events/event-logs";
import {
  createFaqKnowledgeListItem,
  createPolicyKnowledgeListItem,
  type KnowledgeItemType,
  type KnowledgeListItem,
} from "@/lib/knowledge/models";
import type { Database } from "@/types/database";

type KnowledgeSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type FaqItemRow = Database["public"]["Tables"]["faq_items"]["Row"];
type PolicyItemRow = Database["public"]["Tables"]["policy_items"]["Row"];
type KnowledgeRow = FaqItemRow | PolicyItemRow;
type KnowledgeMutationResult =
  | { ok: true; item: KnowledgeListItem }
  | { ok: false; errorCode: "not_found" | "forbidden"; errorMessage: string };
type KnowledgeDeleteResult =
  | { ok: true; itemId: string }
  | { ok: false; errorCode: "not_found" | "forbidden"; errorMessage: string };

const KNOWLEDGE_CONFIG = {
  faq: {
    table: "faq_items",
    entityType: "faq_item",
    mapItem: (row: KnowledgeRow) => createFaqKnowledgeListItem(row as FaqItemRow),
  },
  policy: {
    table: "policy_items",
    entityType: "policy_item",
    mapItem: (row: KnowledgeRow) => createPolicyKnowledgeListItem(row as PolicyItemRow),
  },
} as const satisfies Record<
  KnowledgeItemType,
  { table: "faq_items" | "policy_items"; entityType: string; mapItem: (row: KnowledgeRow) => KnowledgeListItem }
>;

async function ensureHotelAdminActor(supabase: KnowledgeSupabaseClient, hotelId: string, actorHotelUserId: string) {
  const actor = await findActiveHotelUserById(supabase, hotelId, actorHotelUserId);
  return actor?.role === "hotel_admin" ? actor : null;
}

async function rejectKnowledgeOperation(
  hotelId: string,
  itemType: KnowledgeItemType,
  actorHotelUserId: string,
  reason: string,
  itemId?: string,
) {
  await createEventLogSafely({
    hotelId,
    entityType: KNOWLEDGE_CONFIG[itemType].entityType,
    entityId: itemId ?? null,
    eventType: `${itemType}_operation_rejected`,
    payload: { actorHotelUserId, reason },
  });
  return { ok: false, errorCode: "forbidden", errorMessage: "Only hotel admins can manage knowledge." } as const;
}

async function listKnowledgeItemsWithClient(
  supabase: KnowledgeSupabaseClient,
  hotelId: string,
  itemType: KnowledgeItemType,
) {
  const config = KNOWLEDGE_CONFIG[itemType];
  const { data, error } = await supabase.from(config.table).select("*").eq("hotel_id", hotelId).order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as KnowledgeRow[]).map(config.mapItem);
}

async function createKnowledgeItem(
  itemType: KnowledgeItemType,
  input: { hotelId: string; actorHotelUserId: string },
  values: Record<string, string>,
) {
  const supabase = await createServerSupabaseClient();
  if (!(await ensureHotelAdminActor(supabase, input.hotelId, input.actorHotelUserId))) {
    return rejectKnowledgeOperation(input.hotelId, itemType, input.actorHotelUserId, "forbidden");
  }

  const config = KNOWLEDGE_CONFIG[itemType];
  const { data, error } = await supabase
    .from(config.table)
    .insert({ hotel_id: input.hotelId, created_by_hotel_user_id: input.actorHotelUserId, updated_by_hotel_user_id: input.actorHotelUserId, ...values } as never)
    .select("*")
    .single();
  if (error) throw error;

  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: config.entityType,
    entityId: (data as KnowledgeRow).id,
    eventType: `${itemType}_created`,
    payload: { actorHotelUserId: input.actorHotelUserId },
  });
  return { ok: true, item: config.mapItem(data as KnowledgeRow) } satisfies KnowledgeMutationResult;
}

async function updateKnowledgeItem(
  itemType: KnowledgeItemType,
  input: { hotelId: string; actorHotelUserId: string; itemId: string },
  values: Record<string, string>,
) {
  const supabase = await createServerSupabaseClient();
  if (!(await ensureHotelAdminActor(supabase, input.hotelId, input.actorHotelUserId))) {
    return rejectKnowledgeOperation(input.hotelId, itemType, input.actorHotelUserId, "forbidden", input.itemId);
  }

  const config = KNOWLEDGE_CONFIG[itemType];
  const { data, error } = await supabase
    .from(config.table)
    .update({ ...values, updated_by_hotel_user_id: input.actorHotelUserId } as never)
    .eq("hotel_id", input.hotelId)
    .eq("id", input.itemId)
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, errorCode: "not_found", errorMessage: `${config.entityType} was not found.` } satisfies KnowledgeMutationResult;

  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: config.entityType,
    entityId: input.itemId,
    eventType: `${itemType}_updated`,
    payload: { actorHotelUserId: input.actorHotelUserId },
  });
  return { ok: true, item: config.mapItem(data as KnowledgeRow) } satisfies KnowledgeMutationResult;
}

async function deleteKnowledgeItem(itemType: KnowledgeItemType, input: { hotelId: string; actorHotelUserId: string; itemId: string }) {
  const supabase = await createServerSupabaseClient();
  if (!(await ensureHotelAdminActor(supabase, input.hotelId, input.actorHotelUserId))) {
    return rejectKnowledgeOperation(input.hotelId, itemType, input.actorHotelUserId, "forbidden", input.itemId);
  }

  const config = KNOWLEDGE_CONFIG[itemType];
  const { data, error } = await supabase.from(config.table).delete().eq("hotel_id", input.hotelId).eq("id", input.itemId).select("id").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, errorCode: "not_found", errorMessage: `${config.entityType} was not found.` } satisfies KnowledgeDeleteResult;

  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: config.entityType,
    entityId: input.itemId,
    eventType: `${itemType}_deleted`,
    payload: { actorHotelUserId: input.actorHotelUserId },
  });
  return { ok: true, itemId: input.itemId } satisfies KnowledgeDeleteResult;
}

async function setKnowledgeItemPublished(
  itemType: KnowledgeItemType,
  input: { hotelId: string; actorHotelUserId: string; itemId: string; isPublished: boolean },
) {
  const supabase = await createServerSupabaseClient();
  if (!(await ensureHotelAdminActor(supabase, input.hotelId, input.actorHotelUserId))) {
    return rejectKnowledgeOperation(input.hotelId, itemType, input.actorHotelUserId, "forbidden", input.itemId);
  }

  const config = KNOWLEDGE_CONFIG[itemType];
  const { data, error } = await supabase
    .from(config.table)
    .update({ is_published: input.isPublished, published_at: input.isPublished ? new Date().toISOString() : null, updated_by_hotel_user_id: input.actorHotelUserId } as never)
    .eq("hotel_id", input.hotelId)
    .eq("id", input.itemId)
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, errorCode: "not_found", errorMessage: `${config.entityType} was not found.` } satisfies KnowledgeMutationResult;

  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: config.entityType,
    entityId: input.itemId,
    eventType: input.isPublished ? `${itemType}_published` : `${itemType}_unpublished`,
    payload: { actorHotelUserId: input.actorHotelUserId },
  });
  return { ok: true, item: config.mapItem(data as KnowledgeRow) } satisfies KnowledgeMutationResult;
}

export async function listFaqItemsWithClient(supabase: KnowledgeSupabaseClient, hotelId: string) {
  return listKnowledgeItemsWithClient(supabase, hotelId, "faq");
}

export async function listFaqItems(hotelId: string) {
  const supabase = await createServerSupabaseClient();
  return listFaqItemsWithClient(supabase, hotelId);
}

export async function listPolicyItemsWithClient(supabase: KnowledgeSupabaseClient, hotelId: string) {
  return listKnowledgeItemsWithClient(supabase, hotelId, "policy");
}

export async function listPolicyItems(hotelId: string) {
  const supabase = await createServerSupabaseClient();
  return listPolicyItemsWithClient(supabase, hotelId);
}

export async function createFaqItem(input: { hotelId: string; actorHotelUserId: string; question: string; answer: string }) {
  return createKnowledgeItem("faq", input, { question: input.question.trim(), answer: input.answer.trim() });
}

export async function updateFaqItem(input: { hotelId: string; faqItemId: string; actorHotelUserId: string; question: string; answer: string }) {
  return updateKnowledgeItem(
    "faq",
    { hotelId: input.hotelId, actorHotelUserId: input.actorHotelUserId, itemId: input.faqItemId },
    { question: input.question.trim(), answer: input.answer.trim() },
  );
}

export async function deleteFaqItem(input: { hotelId: string; faqItemId: string; actorHotelUserId: string }) {
  return deleteKnowledgeItem("faq", { hotelId: input.hotelId, actorHotelUserId: input.actorHotelUserId, itemId: input.faqItemId });
}

export async function setFaqItemPublished(input: { hotelId: string; faqItemId: string; actorHotelUserId: string; isPublished: boolean }) {
  return setKnowledgeItemPublished("faq", { hotelId: input.hotelId, actorHotelUserId: input.actorHotelUserId, itemId: input.faqItemId, isPublished: input.isPublished });
}

export async function createPolicyItem(input: { hotelId: string; actorHotelUserId: string; title: string; body: string }) {
  return createKnowledgeItem("policy", input, { title: input.title.trim(), body: input.body.trim() });
}

export async function updatePolicyItem(input: { hotelId: string; policyItemId: string; actorHotelUserId: string; title: string; body: string }) {
  return updateKnowledgeItem(
    "policy",
    { hotelId: input.hotelId, actorHotelUserId: input.actorHotelUserId, itemId: input.policyItemId },
    { title: input.title.trim(), body: input.body.trim() },
  );
}

export async function deletePolicyItem(input: { hotelId: string; policyItemId: string; actorHotelUserId: string }) {
  return deleteKnowledgeItem("policy", { hotelId: input.hotelId, actorHotelUserId: input.actorHotelUserId, itemId: input.policyItemId });
}

export async function setPolicyItemPublished(input: { hotelId: string; policyItemId: string; actorHotelUserId: string; isPublished: boolean }) {
  return setKnowledgeItemPublished("policy", { hotelId: input.hotelId, actorHotelUserId: input.actorHotelUserId, itemId: input.policyItemId, isPublished: input.isPublished });
}
