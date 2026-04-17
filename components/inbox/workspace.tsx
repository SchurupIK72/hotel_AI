import Link from "next/link";
import type { AssignableHotelUser } from "@/lib/db/hotel-users";
import { assignConversationAction, updateConversationStatusAction } from "@/app/dashboard/inbox/actions";
import type {
  ConversationDraftPanelState,
  ConversationStatus,
  ConversationWorkspaceDetail,
  InboxFilter,
  InboxConversationListItem,
} from "@/lib/conversations/models";

type InboxWorkspaceProps = {
  assignableHotelUsers: AssignableHotelUser[];
  conversations: InboxConversationListItem[];
  currentFilter: InboxFilter;
  currentHotelUserId: string;
  operationMessage?: string | null;
  operationStatus?: "saved" | "error" | null;
  selectedConversationId?: string | null;
  selectedConversation: ConversationWorkspaceDetail | null;
  missingConversation?: boolean;
};

const FILTER_LINKS: Array<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "assigned_to_me", label: "Assigned to me" },
];
const STATUS_OPTIONS = ["new", "open", "pending", "closed"] as const satisfies readonly ConversationStatus[];

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getFilterHref(filter: InboxFilter) {
  return filter === "all" ? "/dashboard/inbox" : `/dashboard/inbox?filter=${filter}`;
}

function getConversationHref(conversationId: string, currentFilter: InboxFilter) {
  return currentFilter === "all"
    ? `/dashboard/inbox/${conversationId}`
    : `/dashboard/inbox/${conversationId}?filter=${currentFilter}`;
}

function getEmptyListCopy(filter: InboxFilter) {
  if (filter === "unread") {
    return {
      title: "No unread conversations",
      message: "New inbound guest threads will reappear here as soon as unread messages are ingested.",
    };
  }

  if (filter === "assigned_to_me") {
    return {
      title: "Nothing assigned to you",
      message: "Once conversations are assigned to your hotel user, they will appear in this focused inbox view.",
    };
  }

  return {
    title: "No conversations",
    message: "Guest threads will appear here after Telegram ingestion stores inbound messages.",
  };
}

function getAssignableHotelUserLabel(user: AssignableHotelUser) {
  return user.full_name?.trim() || `${user.role.replaceAll("_", " ")} (${user.id.slice(0, 8)})`;
}

function renderDraftPanel(panel: ConversationDraftPanelState) {
  if (panel.state === "ready") {
    return (
      <article className="meta-card stack">
        <div>
          <p className="eyebrow">Drafts</p>
          <h2 className="section-title">{panel.title}</h2>
        </div>
        {panel.drafts.map((draft) => (
          <section className="draft-card stack" key={draft.id}>
            <strong>
              {draft.label}
              {draft.confidenceLabel ? ` · ${draft.confidenceLabel}` : ""}
            </strong>
            <p className="body-copy">{draft.body}</p>
            <p className="conversation-meta mono">Source: {draft.sourceType}</p>
          </section>
        ))}
      </article>
    );
  }

  return (
    <article className="meta-card stack">
      <div>
        <p className="eyebrow">Drafts</p>
        <h2 className="section-title">{panel.title}</h2>
      </div>
      <p className="body-copy">{panel.message}</p>
    </article>
  );
}

function renderWorkspacePlaceholder(
  conversations: InboxConversationListItem[],
  currentFilter: InboxFilter,
  missingConversation: boolean,
) {
  if (missingConversation) {
    return (
      <article className="meta-card stack">
        <div>
          <p className="eyebrow">Conversation not found</p>
          <h2 className="section-title">This conversation is not available in your workspace</h2>
        </div>
        <p className="body-copy">
          The conversation may not exist, may belong to another hotel, or may no longer be accessible.
        </p>
      </article>
    );
  }

  if (conversations.length === 0) {
    const emptyCopy = getEmptyListCopy(currentFilter);
    return (
      <article className="meta-card stack">
        <div>
          <p className="eyebrow">{currentFilter === "all" ? "Inbox empty" : "Filtered inbox empty"}</p>
          <h2 className="section-title">{emptyCopy.title}</h2>
        </div>
        <p className="body-copy">{emptyCopy.message}</p>
        {currentFilter === "all" ? (
          <p className="body-copy">
            If you are setting up the pipeline, check the Telegram settings page and deliver a supported text message first.
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <article className="meta-card stack">
      <div>
        <p className="eyebrow">Conversation workspace</p>
        <h2 className="section-title">Select a conversation from the inbox</h2>
      </div>
      <p className="body-copy">
        Pick any conversation from the list to inspect guest context, read timeline history, and review the reserved draft panel.
      </p>
    </article>
  );
}

export function InboxWorkspace({
  assignableHotelUsers,
  conversations,
  currentFilter,
  currentHotelUserId,
  operationMessage,
  operationStatus,
  selectedConversationId,
  selectedConversation,
  missingConversation = false,
}: InboxWorkspaceProps) {
  const draftPanel = selectedConversation?.draftPanel ?? {
    state: "not_available_yet" as const,
    title: "Draft area reserved",
    message: "Select a conversation to see the draft placeholder that PH1-08 will later populate.",
  };
  const assignedHotelUser =
    selectedConversation &&
    assignableHotelUsers.find((user) => user.id === selectedConversation.conversation.assignedHotelUserId);

  return (
    <div className="inbox-layout">
      <aside className="inbox-pane inbox-list-pane">
        <div className="inbox-pane-header">
          <div>
            <p className="eyebrow">PH1-05</p>
            <h2 className="section-title">Inbox</h2>
          </div>
          <span className="inbox-count">{conversations.length}</span>
        </div>
        <div className="inbox-filter-bar" aria-label="Inbox filters">
          {FILTER_LINKS.map((filter) => (
            <Link
              className={`inbox-filter-link${currentFilter === filter.value ? " inbox-filter-link-selected" : ""}`}
              href={getFilterHref(filter.value)}
              key={filter.value}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        {conversations.length === 0 ? (
          <article className="meta-card stack">
            <h3 className="section-title">{getEmptyListCopy(currentFilter).title}</h3>
            <p className="body-copy">{getEmptyListCopy(currentFilter).message}</p>
          </article>
        ) : (
          <div className="conversation-list">
            {conversations.map((conversation) => {
              const isSelected = selectedConversationId === conversation.id;
              return (
                <Link
                  className={`conversation-row${isSelected ? " conversation-row-selected" : ""}`}
                  href={getConversationHref(conversation.id, currentFilter)}
                  key={conversation.id}
                >
                  <div className="conversation-row-header">
                    <strong>{conversation.guestDisplayName}</strong>
                    {conversation.unreadCount > 0 ? (
                      <span className="conversation-unread-badge">{conversation.unreadCount}</span>
                    ) : null}
                  </div>
                  {conversation.guestHandle ? (
                    <p className="conversation-meta mono">{conversation.guestHandle}</p>
                  ) : null}
                  <p className="conversation-preview">{conversation.lastMessagePreview}</p>
                  <div className="conversation-row-footer">
                    <span>{formatDateTime(conversation.lastMessageAt)}</span>
                    <span className="conversation-pill">{formatStatusLabel(conversation.status)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </aside>

      <section className="inbox-pane inbox-detail-pane">
        <div className="stack">
          {operationStatus && operationMessage ? (
            <article className={`meta-card operation-banner operation-banner-${operationStatus}`}>
              <p className={operationStatus === "error" ? "error-text" : "success-text"}>{operationMessage}</p>
            </article>
          ) : null}
          {selectedConversation ? (
            <div className="stack">
            <header className="inbox-pane-header">
              <div>
                <p className="eyebrow">Conversation</p>
                <h2 className="section-title">{selectedConversation.guest.displayName}</h2>
              </div>
              <div className="conversation-meta-stack">
                <span className="conversation-pill">{formatStatusLabel(selectedConversation.conversation.status)}</span>
                <span className="conversation-pill">{formatStatusLabel(selectedConversation.conversation.mode)}</span>
              </div>
            </header>

            <article className="meta-card conversation-detail-card">
              <div className="conversation-detail-grid">
                <div>
                  <span className="eyebrow">Channel</span>
                  <p className="body-copy mono">{selectedConversation.conversation.channel}</p>
                </div>
                <div>
                  <span className="eyebrow">Unread</span>
                  <p className="body-copy mono">{selectedConversation.conversation.unreadCount}</p>
                </div>
                <div>
                  <span className="eyebrow">Last activity</span>
                  <p className="body-copy mono">{formatDateTime(selectedConversation.conversation.lastMessageAt)}</p>
                </div>
                <div>
                  <span className="eyebrow">Assigned hotel user</span>
                  <p className="body-copy mono">
                    {assignedHotelUser
                      ? getAssignableHotelUserLabel(assignedHotelUser)
                      : selectedConversation.conversation.assignedHotelUserId ?? "Unassigned"}
                  </p>
                </div>
              </div>
            </article>

            <div className="conversation-controls-grid">
              <article className="meta-card stack">
                <div>
                  <p className="eyebrow">Status</p>
                  <h3 className="section-title">Workflow state</h3>
                </div>
                <form action={updateConversationStatusAction} className="control-form">
                  <input name="conversationId" type="hidden" value={selectedConversation.conversation.id} />
                  <input name="filter" type="hidden" value={currentFilter} />
                  <label className="label-stack">
                    <span>Current status</span>
                    <select
                      className="input"
                      defaultValue={selectedConversation.conversation.status}
                      name="nextStatus"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button" type="submit">
                    Save status
                  </button>
                </form>
              </article>

              <article className="meta-card stack">
                <div>
                  <p className="eyebrow">Assignment</p>
                  <h3 className="section-title">Responsible staff user</h3>
                </div>
                <form action={assignConversationAction} className="control-form">
                  <input name="conversationId" type="hidden" value={selectedConversation.conversation.id} />
                  <input name="filter" type="hidden" value={currentFilter} />
                  <label className="label-stack">
                    <span>Current assignee</span>
                    <select
                      className="input"
                      defaultValue={selectedConversation.conversation.assignedHotelUserId ?? ""}
                      name="assignedHotelUserId"
                    >
                      <option value="">Unassigned</option>
                      {assignableHotelUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {getAssignableHotelUserLabel(user)}
                          {user.id === currentHotelUserId ? " (You)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button secondary-button" type="submit">
                    Save assignment
                  </button>
                </form>
              </article>
            </div>

            <article className="timeline-card">
              <div className="inbox-pane-header">
                <div>
                  <p className="eyebrow">Timeline</p>
                  <h3 className="section-title">Message history</h3>
                </div>
              </div>
              {selectedConversation.messages.length === 0 ? (
                <p className="body-copy">This conversation does not have renderable text messages yet.</p>
              ) : (
                <div className="timeline-list">
                  {selectedConversation.messages.map((message) => (
                    <article
                      className={`timeline-message timeline-message-${message.direction}`}
                      key={message.id}
                    >
                      <div className="timeline-message-header">
                        <strong>{message.direction === "inbound" ? "Guest" : "Hotel staff"}</strong>
                        <span>{formatDateTime(message.deliveredAt ?? message.createdAt)}</span>
                      </div>
                      <p className="body-copy">{message.textBody}</p>
                    </article>
                  ))}
                </div>
              )}
            </article>
            </div>
          ) : (
            renderWorkspacePlaceholder(conversations, currentFilter, missingConversation)
          )}
        </div>
      </section>

      <aside className="inbox-pane inbox-sidebar-pane">
        {selectedConversation ? (
          <div className="stack">
            <article className="meta-card stack">
              <div>
                <p className="eyebrow">Guest</p>
                <h2 className="section-title">{selectedConversation.guest.displayName}</h2>
              </div>
              <div className="stack">
                <p className="body-copy mono">
                  Telegram: {selectedConversation.guest.telegramUsername ? `@${selectedConversation.guest.telegramUsername}` : "Unknown"}
                </p>
                <p className="body-copy mono">Language: {selectedConversation.guest.languageCode ?? "Unknown"}</p>
                <p className="body-copy mono">
                  Last guest activity: {formatDateTime(selectedConversation.guest.lastMessageAt)}
                </p>
              </div>
            </article>
            {renderDraftPanel(draftPanel)}
          </div>
        ) : (
          <div className="stack">
            <article className="meta-card stack">
              <div>
                <p className="eyebrow">Guest</p>
                <h2 className="section-title">Guest summary will appear here</h2>
              </div>
              <p className="body-copy">Open a conversation to inspect the normalized guest profile created by PH1-03.</p>
            </article>
            {renderDraftPanel(draftPanel)}
          </div>
        )}
      </aside>
    </div>
  );
}
