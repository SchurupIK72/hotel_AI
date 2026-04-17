import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectLatestDraftGeneration, type StoredConversationDraft } from "@/lib/copilot/models";
import type { Database } from "@/types/database";

type CopilotSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type AiDraftRow = Database["public"]["Tables"]["ai_drafts"]["Row"];

export async function listLatestConversationDraftsWithClient(
  supabase: CopilotSupabaseClient,
  hotelId: string,
  conversationId: string,
): Promise<StoredConversationDraft[]> {
  const { data, error } = await supabase
    .from("ai_drafts")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("draft_index", { ascending: true });

  if (error) {
    throw error;
  }

  return selectLatestDraftGeneration((data ?? []) as AiDraftRow[]);
}

export async function listLatestConversationDrafts(hotelId: string, conversationId: string) {
  const supabase = await createServerSupabaseClient();
  return listLatestConversationDraftsWithClient(supabase, hotelId, conversationId);
}
