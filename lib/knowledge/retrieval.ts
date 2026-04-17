import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RetrieveKnowledgeInput } from "@/lib/knowledge/retrieval-models";
import {
  listPublishedFaqCandidatesWithClient,
  listPublishedPolicyCandidatesWithClient,
  retrieveKnowledgeWithClient,
} from "@/lib/knowledge/retrieval-service";

export async function listPublishedFaqCandidates(hotelId: string) {
  const supabase = await createServerSupabaseClient();
  return listPublishedFaqCandidatesWithClient(supabase, hotelId);
}

export async function listPublishedPolicyCandidates(hotelId: string) {
  const supabase = await createServerSupabaseClient();
  return listPublishedPolicyCandidatesWithClient(supabase, hotelId);
}

export async function retrieveKnowledge(input: RetrieveKnowledgeInput) {
  const supabase = await createServerSupabaseClient();
  return retrieveKnowledgeWithClient(supabase, input);
}
