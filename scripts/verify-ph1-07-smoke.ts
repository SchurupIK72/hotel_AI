import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createServiceRoleSupabaseClient } from "../lib/supabase/admin.ts";
import {
  listPublishedFaqCandidatesWithClient,
  listPublishedPolicyCandidatesWithClient,
  retrieveKnowledgeWithClient,
} from "../lib/knowledge/retrieval-service.ts";

const envPath = path.join(process.cwd(), ".env.local");
const hotelIdFallback = "11111111-1111-1111-1111-111111111111";

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

async function cleanupSmokeData(hotelId: string) {
  const supabase = createServiceRoleSupabaseClient();
  await supabase.from("event_logs").delete().eq("hotel_id", hotelId).like("entity_id", "ph1-07-smoke-%");
  await supabase.from("faq_items").delete().eq("hotel_id", hotelId).like("question", "PH1-07 smoke%");
  await supabase.from("policy_items").delete().eq("hotel_id", hotelId).like("title", "PH1-07 smoke%");
}

async function createFaqItem(hotelId: string, actorHotelUserId: string, question: string, answer: string, isPublished: boolean) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("faq_items")
    .insert({
      hotel_id: hotelId,
      question,
      answer,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      created_by_hotel_user_id: actorHotelUserId,
      updated_by_hotel_user_id: actorHotelUserId,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function createPolicyItem(hotelId: string, actorHotelUserId: string, title: string, body: string, isPublished: boolean) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("policy_items")
    .insert({
      hotel_id: hotelId,
      title,
      body,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      created_by_hotel_user_id: actorHotelUserId,
      updated_by_hotel_user_id: actorHotelUserId,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function listEventLogRows(hotelId: string, entityId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("event_logs")
    .select("event_type, payload")
    .eq("hotel_id", hotelId)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ event_type: string; payload: Record<string, unknown> }>;
}

async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = requireEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.env.SUPABASE_SERVICE_ROLE_KEY = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const hotelId = env.DEMO_HOTEL_ID ?? hotelIdFallback;
  const actorHotelUserId = await findHotelAdminId(hotelId);
  if (!actorHotelUserId) throw new Error("Expected an active hotel_admin user for PH1-07 smoke verification.");

  await cleanupSmokeData(hotelId);

  await createFaqItem(
    hotelId,
    actorHotelUserId,
    "PH1-07 smoke what time is breakfast served",
    "Breakfast is served daily from 07:00 to 10:30.",
    true,
  );
  await createFaqItem(
    hotelId,
    actorHotelUserId,
    "PH1-07 smoke airport shuttle",
    "Airport shuttle runs every hour from terminal A.",
    false,
  );
  await createPolicyItem(
    hotelId,
    actorHotelUserId,
    "PH1-07 smoke late checkout policy",
    "Late checkout is subject to availability and must be confirmed by the front desk.",
    true,
  );
  await createPolicyItem(
    hotelId,
    actorHotelUserId,
    "PH1-07 smoke VIP late checkout",
    "Guaranteed late checkout until 16:00 is available only for VIP cases.",
    false,
  );

  const supabase = createServiceRoleSupabaseClient();
  const faqCandidates = await listPublishedFaqCandidatesWithClient(supabase, hotelId);
  const policyCandidates = await listPublishedPolicyCandidatesWithClient(supabase, hotelId);
  assert.equal(faqCandidates.some((item) => item.title === "PH1-07 smoke what time is breakfast served"), true);
  assert.equal(faqCandidates.some((item) => item.title === "PH1-07 smoke airport shuttle"), false);
  assert.equal(policyCandidates.some((item) => item.title === "PH1-07 smoke late checkout policy"), true);
  assert.equal(policyCandidates.some((item) => item.title === "PH1-07 smoke VIP late checkout"), false);

  const breakfastConversationId = `ph1-07-smoke-${crypto.randomUUID()}`;
  const breakfastResult = await retrieveKnowledgeWithClient(supabase, {
    hotelId,
    conversationId: breakfastConversationId,
    messageId: "ph1-07-smoke-breakfast",
    messageText: "What time is breakfast served?",
  });
  assert.equal(breakfastResult.status, "evidence_found");
  assert.equal(breakfastResult.evidence[0]?.itemType, "faq");

  const lateCheckoutConversationId = `ph1-07-smoke-${crypto.randomUUID()}`;
  const lateCheckoutResult = await retrieveKnowledgeWithClient(supabase, {
    hotelId,
    conversationId: lateCheckoutConversationId,
    messageId: "ph1-07-smoke-late-checkout",
    messageText: "Can I request a late checkout?",
  });
  assert.equal(lateCheckoutResult.status, "evidence_found");
  assert.equal(lateCheckoutResult.evidence[0]?.itemType, "policy");
  assert.equal(lateCheckoutResult.evidence.some((item) => item.title === "PH1-07 smoke VIP late checkout"), false);

  const noEvidenceConversationId = `ph1-07-smoke-${crypto.randomUUID()}`;
  const noEvidenceResult = await retrieveKnowledgeWithClient(supabase, {
    hotelId,
    conversationId: noEvidenceConversationId,
    messageId: "ph1-07-smoke-no-evidence",
    messageText: "Do you have an airport shuttle?",
  });
  assert.equal(noEvidenceResult.status, "no_relevant_evidence");
  assert.deepEqual(noEvidenceResult.evidence, []);

  const lateCheckoutEvents = await listEventLogRows(hotelId, lateCheckoutConversationId);
  assert.deepEqual(
    lateCheckoutEvents.map((row) => row.event_type),
    ["kb_retrieval_requested", "kb_retrieval_completed"],
  );
  assert.equal(lateCheckoutEvents[1]?.payload?.retrievalStatus, "evidence_found");
  assert.equal(lateCheckoutEvents[1]?.payload?.evidenceCount, 1);
  assert.equal(Array.isArray(lateCheckoutEvents[1]?.payload?.evidenceSummary), true);

  const noEvidenceEvents = await listEventLogRows(hotelId, noEvidenceConversationId);
  assert.equal(noEvidenceEvents[1]?.payload?.retrievalStatus, "no_relevant_evidence");
  assert.equal(noEvidenceEvents[1]?.payload?.evidenceCount, 0);

  console.log("PH1-07 smoke verification passed.");
  console.log(`hotel=${hotelId} breakfast=${breakfastConversationId} late_checkout=${lateCheckoutConversationId}`);
}

main().catch((error) => {
  console.error("PH1-07 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
