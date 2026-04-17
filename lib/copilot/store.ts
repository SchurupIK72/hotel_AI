import type { SupabaseClient } from "@supabase/supabase-js";
import { selectLatestDraftGeneration, type StoredConversationDraft } from "./models.ts";
import type { Database } from "../../types/database.ts";

type CopilotSupabaseClient = {
  from: SupabaseClient<Database>["from"];
};
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
  const { createServerSupabaseClient } = await import("../supabase/server.ts");
  const supabase = await createServerSupabaseClient();
  return listLatestConversationDraftsWithClient(supabase, hotelId, conversationId);
}

export async function listLatestDraftsForMessageWithClient(
  supabase: CopilotSupabaseClient,
  hotelId: string,
  conversationId: string,
  messageId: string,
): Promise<StoredConversationDraft[]> {
  const { data, error } = await supabase
    .from("ai_drafts")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", conversationId)
    .eq("message_id", messageId)
    .order("created_at", { ascending: false })
    .order("draft_index", { ascending: true });

  if (error) {
    throw error;
  }

  return selectLatestDraftGeneration((data ?? []) as AiDraftRow[]);
}
