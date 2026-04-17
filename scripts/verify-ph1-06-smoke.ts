import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createServiceRoleSupabaseClient } from "../lib/supabase/admin.ts";
import { createEventLogSafely } from "../lib/events/event-logs.ts";

const envPath = path.join(process.cwd(), ".env.local");
const hotelIdFallback = "11111111-1111-1111-1111-111111111111";

const KNOWLEDGE_CONFIG = {
  faq: {
    table: "faq_items",
    entityType: "faq_item",
    titleColumn: "question",
    bodyColumn: "answer",
    smokeTitle: "PH1-06 smoke FAQ question",
  },
  policy: {
    table: "policy_items",
    entityType: "policy_item",
    titleColumn: "title",
    bodyColumn: "body",
    smokeTitle: "PH1-06 smoke policy",
  },
} as const;

type KnowledgeKind = keyof typeof KNOWLEDGE_CONFIG;

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {} as Record<string, string>;
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
      }),
  );
}

function requireEnv(env: Record<string, string | undefined>, name: string) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function logKnowledgeEvent(hotelId: string, entityType: string, entityId: string, eventType: string, actorHotelUserId: string) {
  await createEventLogSafely({
    hotelId,
    entityType,
    entityId,
    eventType,
    payload: { actorHotelUserId },
  });
}

async function createKnowledgeItem(kind: KnowledgeKind, hotelId: string, actorHotelUserId: string, bodyValue: string) {
  const config = KNOWLEDGE_CONFIG[kind];
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from(config.table)
    .insert({
      hotel_id: hotelId,
      [config.titleColumn]: config.smokeTitle,
      [config.bodyColumn]: bodyValue,
      created_by_hotel_user_id: actorHotelUserId,
      updated_by_hotel_user_id: actorHotelUserId,
    } as never)
    .select("id, is_published, published_at")
    .single();
  if (error) throw error;
  await logKnowledgeEvent(hotelId, config.entityType, (data as { id: string }).id, `${kind}_created`, actorHotelUserId);
  return data as { id: string; is_published: boolean; published_at: string | null };
}

async function updateKnowledgeItem(kind: KnowledgeKind, hotelId: string, actorHotelUserId: string, itemId: string, bodyValue: string) {
  const config = KNOWLEDGE_CONFIG[kind];
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from(config.table)
    .update({ [config.bodyColumn]: bodyValue, updated_by_hotel_user_id: actorHotelUserId } as never)
    .eq("hotel_id", hotelId)
    .eq("id", itemId)
    .select(`id, ${config.bodyColumn}`)
    .single();
  if (error) throw error;
  await logKnowledgeEvent(hotelId, config.entityType, itemId, `${kind}_updated`, actorHotelUserId);
  return data as { id: string } & Record<string, string>;
}

async function setKnowledgePublished(kind: KnowledgeKind, hotelId: string, actorHotelUserId: string, itemId: string, isPublished: boolean) {
  const config = KNOWLEDGE_CONFIG[kind];
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from(config.table)
    .update({
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      updated_by_hotel_user_id: actorHotelUserId,
    } as never)
    .eq("hotel_id", hotelId)
    .eq("id", itemId)
    .select("id, is_published, published_at")
    .single();
  if (error) throw error;
  await logKnowledgeEvent(hotelId, config.entityType, itemId, isPublished ? `${kind}_published` : `${kind}_unpublished`, actorHotelUserId);
  return data as { id: string; is_published: boolean; published_at: string | null };
}

async function deleteKnowledgeItem(kind: KnowledgeKind, hotelId: string, actorHotelUserId: string, itemId: string) {
  const config = KNOWLEDGE_CONFIG[kind];
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from(config.table).delete().eq("hotel_id", hotelId).eq("id", itemId);
  if (error) throw error;
  await logKnowledgeEvent(hotelId, config.entityType, itemId, `${kind}_deleted`, actorHotelUserId);
}

async function cleanupSmokeKnowledge(hotelId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const entityIds: string[] = [];

  for (const kind of Object.keys(KNOWLEDGE_CONFIG) as KnowledgeKind[]) {
    const config = KNOWLEDGE_CONFIG[kind];
    const { data, error } = await supabase
      .from(config.table)
      .select("id")
      .eq("hotel_id", hotelId)
      .eq(config.titleColumn, config.smokeTitle);
    if (error) throw error;
    entityIds.push(...((data ?? []) as Array<{ id: string }>).map((row) => row.id));
    await supabase.from(config.table).delete().eq("hotel_id", hotelId).eq(config.titleColumn, config.smokeTitle);
  }

  if (entityIds.length > 0) {
    await supabase.from("event_logs").delete().eq("hotel_id", hotelId).in("entity_id", entityIds);
  }
}

async function findHotelAdminId(hotelId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("hotel_users")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .eq("role", "hotel_admin")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return ((data as { id: string } | null) ?? null)?.id ?? null;
}

async function readKnowledgeState(kind: KnowledgeKind, hotelId: string, itemId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from(KNOWLEDGE_CONFIG[kind].table)
    .select("id, is_published, published_at")
    .eq("hotel_id", hotelId)
    .eq("id", itemId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string; is_published: boolean; published_at: string | null } | null) ?? null;
}

async function listEventTypes(hotelId: string, entityId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("event_logs")
    .select("event_type")
    .eq("hotel_id", hotelId)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{ event_type: string }>).map((row) => row.event_type);
}

async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = requireEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.env.SUPABASE_SERVICE_ROLE_KEY = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const hotelId = env.DEMO_HOTEL_ID ?? hotelIdFallback;
  const actorHotelUserId = await findHotelAdminId(hotelId);
  if (!actorHotelUserId) throw new Error("Expected an active hotel_admin user for PH1-06 smoke verification.");

  await cleanupSmokeKnowledge(hotelId);

  const faqCreate = await createKnowledgeItem("faq", hotelId, actorHotelUserId, "Draft answer for PH1-06 smoke verification.");
  assert.equal(faqCreate.is_published, false);
  assert.equal(faqCreate.published_at, null);

  const faqUpdate = await updateKnowledgeItem("faq", hotelId, actorHotelUserId, faqCreate.id, "Published FAQ answer for PH1-06 smoke verification.");
  assert.equal(faqUpdate.answer, "Published FAQ answer for PH1-06 smoke verification.");

  const faqPublish = await setKnowledgePublished("faq", hotelId, actorHotelUserId, faqCreate.id, true);
  assert.equal(faqPublish.is_published, true);
  assert.notEqual(faqPublish.published_at, null);

  const policyCreate = await createKnowledgeItem("policy", hotelId, actorHotelUserId, "Draft policy body for PH1-06 smoke verification.");
  assert.equal(policyCreate.is_published, false);
  assert.equal(policyCreate.published_at, null);

  const policyUpdate = await updateKnowledgeItem("policy", hotelId, actorHotelUserId, policyCreate.id, "Updated policy body for PH1-06 smoke verification.");
  assert.equal(policyUpdate.body, "Updated policy body for PH1-06 smoke verification.");

  const policyPublish = await setKnowledgePublished("policy", hotelId, actorHotelUserId, policyCreate.id, true);
  assert.equal(policyPublish.is_published, true);

  const policyUnpublish = await setKnowledgePublished("policy", hotelId, actorHotelUserId, policyCreate.id, false);
  assert.equal(policyUnpublish.is_published, false);
  assert.equal(policyUnpublish.published_at, null);

  const faqState = await readKnowledgeState("faq", hotelId, faqCreate.id);
  const policyState = await readKnowledgeState("policy", hotelId, policyCreate.id);
  assert.equal(faqState?.is_published, true);
  assert.equal(policyState?.is_published, false);

  await deleteKnowledgeItem("faq", hotelId, actorHotelUserId, faqCreate.id);
  await deleteKnowledgeItem("policy", hotelId, actorHotelUserId, policyCreate.id);

  assert.deepEqual(await listEventTypes(hotelId, faqCreate.id), ["faq_created", "faq_updated", "faq_published", "faq_deleted"]);
  assert.deepEqual(await listEventTypes(hotelId, policyCreate.id), ["policy_created", "policy_updated", "policy_published", "policy_unpublished", "policy_deleted"]);

  console.log("PH1-06 smoke verification passed.");
  console.log(`faq=${faqCreate.id} policy=${policyCreate.id} hotelAdmin=${actorHotelUserId}`);
}

main().catch((error) => {
  console.error("PH1-06 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
