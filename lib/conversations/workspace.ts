import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listLatestConversationDraftsWithClient } from "@/lib/copilot/store";
import type { Database } from "@/types/database";
import {
  createConversationWorkspaceDetail,
  createDraftPanelState,
  createInboxConversationListItem,
  type InboxFilter,
  type ConversationWorkspaceDetail,
  type InboxConversationListItem,
} from "@/lib/conversations/models";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

type ConversationListRow = Pick<
  ConversationRow,
  | "id"
  | "guest_id"
  | "channel"
  | "status"
  | "mode"
  | "assigned_hotel_user_id"
  | "last_message_preview"
  | "last_message_at"
  | "last_inbound_message_at"
  | "unread_count"
  | "last_ai_draft_at"
>;

type ConversationDetailRow = Pick<
  ConversationRow,
  | "id"
  | "guest_id"
  | "channel"
  | "status"
  | "mode"
  | "assigned_hotel_user_id"
  | "subject"
  | "last_message_preview"
  | "last_message_at"
  | "last_inbound_message_at"
  | "unread_count"
  | "last_ai_draft_at"
  | "created_at"
>;

type GuestSummaryRow = Pick<
  GuestRow,
  | "id"
  | "display_name"
  | "telegram_username"
  | "first_name"
  | "last_name"
  | "language_code"
  | "last_message_at"
>;

type MessageTimelineRow = Pick<
  MessageRow,
  | "id"
  | "conversation_id"
  | "guest_id"
  | "direction"
  | "message_type"
  | "text_body"
  | "created_at"
  | "delivered_at"
>;

export type WorkspaceSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type ListInboxConversationsInput = {
  hotelId: string;
  filter?: InboxFilter;
  currentHotelUserId?: string | null;
};

async function getGuestsByIds(
  supabase: WorkspaceSupabaseClient,
  hotelId: string,
  guestIds: string[],
) {
  if (guestIds.length === 0) {
    return new Map<string, GuestSummaryRow>();
  }

  const { data, error } = await supabase
    .from("guests")
    .select("id, display_name, telegram_username, first_name, last_name, language_code, last_message_at")
    .eq("hotel_id", hotelId)
    .in("id", guestIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as GuestSummaryRow[]).map((guest) => [guest.id, guest] satisfies [string, GuestSummaryRow]),
  );
}

export async function listInboxConversationsWithClient(
  supabase: WorkspaceSupabaseClient,
  input: ListInboxConversationsInput,
): Promise<InboxConversationListItem[]> {
  const filter = input.filter ?? "all";
  if (filter === "assigned_to_me" && !input.currentHotelUserId) {
    return [];
  }

  let query = supabase
    .from("conversations")
    .select(
      "id, guest_id, channel, status, mode, assigned_hotel_user_id, last_message_preview, last_message_at, last_inbound_message_at, unread_count, last_ai_draft_at",
    )
    .eq("hotel_id", input.hotelId);

  if (filter === "unread") {
    query = query.gt("unread_count", 0);
  }

  if (filter === "assigned_to_me") {
    query = query.eq("assigned_hotel_user_id", input.currentHotelUserId as string);
  }

  const { data, error } = await query.order("last_message_at", { ascending: false });

  if (error) {
    throw error;
  }

  const conversations = (data ?? []) as ConversationListRow[];
  const guestMap = await getGuestsByIds(
    supabase,
    input.hotelId,
    [...new Set(conversations.map((conversation) => conversation.guest_id))],
  );

  return conversations.map((conversation) =>
    createInboxConversationListItem(conversation, guestMap.get(conversation.guest_id) ?? null),
  );
}

export async function listInboxConversations(
  hotelId: string,
  options?: Omit<ListInboxConversationsInput, "hotelId">,
): Promise<InboxConversationListItem[]> {
  const supabase = await createServerSupabaseClient();
  return listInboxConversationsWithClient(supabase, { hotelId, ...options });
}

export async function listConversationMessagesWithClient(
  supabase: WorkspaceSupabaseClient,
  hotelId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, guest_id, direction, message_type, text_body, created_at, delivered_at")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as MessageTimelineRow[];
}

export async function listConversationMessages(hotelId: string, conversationId: string) {
  const supabase = await createServerSupabaseClient();
  return listConversationMessagesWithClient(supabase, hotelId, conversationId);
}

export async function getConversationWorkspaceWithClient(
  supabase: WorkspaceSupabaseClient,
  hotelId: string,
  conversationId: string,
): Promise<ConversationWorkspaceDetail | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, guest_id, channel, status, mode, assigned_hotel_user_id, subject, last_message_preview, last_message_at, last_inbound_message_at, unread_count, last_ai_draft_at, created_at",
    )
    .eq("hotel_id", hotelId)
    .eq("id", conversationId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const conversation = (data as ConversationDetailRow | null) ?? null;
  if (!conversation) {
    return null;
  }

  const [guestMap, messages, draftsResult] = await Promise.all([
    getGuestsByIds(supabase, hotelId, [conversation.guest_id]),
    listConversationMessagesWithClient(supabase, hotelId, conversationId),
    listLatestConversationDraftsWithClient(supabase, hotelId, conversationId)
      .then((drafts) => ({ ok: true as const, drafts }))
      .catch((error) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : "Drafts could not be loaded.",
      })),
  ]);

  return createConversationWorkspaceDetail({
    conversation,
    guest: guestMap.get(conversation.guest_id) ?? null,
    messages,
    draftPanel: draftsResult.ok
      ? createDraftPanelState({ state: "empty", drafts: draftsResult.drafts })
      : createDraftPanelState({ errorMessage: draftsResult.message }),
  });
}

export async function getConversationWorkspace(
  hotelId: string,
  conversationId: string,
): Promise<ConversationWorkspaceDetail | null> {
  const supabase = await createServerSupabaseClient();
  return getConversationWorkspaceWithClient(supabase, hotelId, conversationId);
}
