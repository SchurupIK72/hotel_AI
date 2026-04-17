import type { Database } from "@/types/database";
import type { StoredConversationDraft } from "@/lib/copilot/models";

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

export const PHASE1_CONVERSATION_STATUSES = ["new", "open", "pending", "closed"] as const;
export const PHASE1_INBOX_FILTERS = ["all", "unread", "assigned_to_me"] as const;

export type ConversationStatus = (typeof PHASE1_CONVERSATION_STATUSES)[number];
export type InboxFilter = (typeof PHASE1_INBOX_FILTERS)[number];

export type InboxConversationListItem = {
  id: string;
  guestId: string;
  guestDisplayName: string;
  guestHandle: string | null;
  guestLanguageCode: string | null;
  channel: ConversationRow["channel"];
  status: ConversationRow["status"];
  mode: ConversationRow["mode"];
  assignedHotelUserId: string | null;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastInboundMessageAt: string | null;
  unreadCount: number;
};

export function resolveSelectedConversationId(
  conversations: InboxConversationListItem[],
  requestedConversationId?: string | null,
) {
  if (requestedConversationId) {
    const requested = conversations.find((conversation) => conversation.id === requestedConversationId);
    if (requested) {
      return requested.id;
    }
  }

  return conversations[0]?.id ?? null;
}

export type ConversationGuestSummary = {
  id: string;
  displayName: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  languageCode: string | null;
  lastMessageAt: string | null;
};

export type ConversationMessageTimelineItem = {
  id: string;
  conversationId: string;
  guestId: string | null;
  direction: MessageRow["direction"];
  messageType: MessageRow["message_type"];
  textBody: string;
  createdAt: string;
  deliveredAt: string | null;
};

export type ConversationDraftPanelState =
  | { state: "not_available_yet"; title: string; message: string }
  | { state: "empty"; title: string; message: string }
  | {
      state: "ready";
      title: string;
      drafts: Array<{
        id: string;
        label: string;
        body: string;
        confidenceLabel: string | null;
        createdAt: string;
        modelName: string | null;
        sourceType: StoredConversationDraft["sourceType"];
      }>;
    }
  | { state: "error"; title: string; message: string };

export function isConversationStatus(value: string): value is ConversationStatus {
  return PHASE1_CONVERSATION_STATUSES.includes(value as ConversationStatus);
}

export function isInboxFilter(value: string): value is InboxFilter {
  return PHASE1_INBOX_FILTERS.includes(value as InboxFilter);
}

export function resolveInboxFilter(value: string | null | undefined): InboxFilter {
  return value && isInboxFilter(value) ? value : "all";
}

export type ConversationWorkspaceDetail = {
  conversation: {
    id: string;
    guestId: string;
    channel: ConversationRow["channel"];
    status: ConversationRow["status"];
    mode: ConversationRow["mode"];
    assignedHotelUserId: string | null;
    subject: string | null;
    lastMessagePreview: string;
    lastMessageAt: string;
    lastInboundMessageAt: string | null;
    unreadCount: number;
    lastAiDraftAt: string | null;
    createdAt: string;
  };
  guest: ConversationGuestSummary;
  messages: ConversationMessageTimelineItem[];
  draftPanel: ConversationDraftPanelState;
};

function buildGuestDisplayName(guest: Partial<GuestSummaryRow> | null | undefined) {
  const preferred = guest?.display_name?.trim();
  if (preferred) {
    return preferred;
  }

  const fullName = [guest?.first_name, guest?.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (guest?.telegram_username) {
    return `@${guest.telegram_username}`;
  }

  return "Telegram guest";
}

export function createInboxConversationListItem(
  conversation: ConversationListRow,
  guest: GuestSummaryRow | null,
): InboxConversationListItem {
  return {
    id: conversation.id,
    guestId: conversation.guest_id,
    guestDisplayName: buildGuestDisplayName(guest),
    guestHandle: guest?.telegram_username ? `@${guest.telegram_username}` : null,
    guestLanguageCode: guest?.language_code ?? null,
    channel: conversation.channel,
    status: conversation.status,
    mode: conversation.mode,
    assignedHotelUserId: conversation.assigned_hotel_user_id,
    lastMessagePreview: conversation.last_message_preview?.trim() || "No messages yet",
    lastMessageAt: conversation.last_message_at,
    lastInboundMessageAt: conversation.last_inbound_message_at,
    unreadCount: conversation.unread_count,
  };
}

export function createConversationGuestSummary(guest: GuestSummaryRow | null, guestId: string) {
  return {
    id: guest?.id ?? guestId,
    displayName: buildGuestDisplayName(guest),
    telegramUsername: guest?.telegram_username ?? null,
    firstName: guest?.first_name ?? null,
    lastName: guest?.last_name ?? null,
    languageCode: guest?.language_code ?? null,
    lastMessageAt: guest?.last_message_at ?? null,
  } satisfies ConversationGuestSummary;
}

export function createConversationMessageTimelineItem(message: MessageTimelineRow) {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    guestId: message.guest_id,
    direction: message.direction,
    messageType: message.message_type,
    textBody: message.text_body,
    createdAt: message.created_at,
    deliveredAt: message.delivered_at,
  } satisfies ConversationMessageTimelineItem;
}

export function createDraftPanelState(input?: {
  state?: "not_available_yet" | "empty";
  message?: string | null;
  errorMessage?: string | null;
  drafts?: StoredConversationDraft[] | null;
}) {
  if (input?.errorMessage) {
    return {
      state: "error",
      title: "Draft panel unavailable",
      message: input.errorMessage,
    } satisfies ConversationDraftPanelState;
  }

  if (input?.drafts?.length) {
    return {
      state: "ready",
      title: "Latest AI drafts",
      drafts: input.drafts.map((draft) => ({
        id: draft.id,
        label: `Draft ${draft.draftIndex}`,
        body: draft.draftText,
        confidenceLabel: draft.confidenceLabel,
        createdAt: draft.createdAt,
        modelName: draft.modelName,
        sourceType: draft.sourceType,
      })),
    } satisfies ConversationDraftPanelState;
  }

  if (input?.state === "empty") {
    return {
      state: "empty",
      title: "No drafts yet",
      message: input.message ?? "This conversation does not have stored drafts yet.",
    } satisfies ConversationDraftPanelState;
  }

  return {
    state: "not_available_yet",
    title: "AI drafts are not wired yet",
    message:
      input?.message ??
      "PH1-04 reserves this panel so PH1-08 can attach generated drafts without redesigning the workspace.",
  } satisfies ConversationDraftPanelState;
}

export function createConversationWorkspaceDetail(input: {
  conversation: ConversationDetailRow;
  guest: GuestSummaryRow | null;
  messages: MessageTimelineRow[];
  draftPanel?: ConversationDraftPanelState;
}) {
  return {
    conversation: {
      id: input.conversation.id,
      guestId: input.conversation.guest_id,
      channel: input.conversation.channel,
      status: input.conversation.status,
      mode: input.conversation.mode,
      assignedHotelUserId: input.conversation.assigned_hotel_user_id,
      subject: input.conversation.subject,
      lastMessagePreview: input.conversation.last_message_preview?.trim() || "No messages yet",
      lastMessageAt: input.conversation.last_message_at,
      lastInboundMessageAt: input.conversation.last_inbound_message_at,
      unreadCount: input.conversation.unread_count,
      lastAiDraftAt: input.conversation.last_ai_draft_at,
      createdAt: input.conversation.created_at,
    },
    guest: createConversationGuestSummary(input.guest, input.conversation.guest_id),
    messages: input.messages.map(createConversationMessageTimelineItem),
    draftPanel: input.draftPanel ?? createDraftPanelState(),
  } satisfies ConversationWorkspaceDetail;
}
