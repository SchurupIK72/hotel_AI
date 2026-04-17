import Link from "next/link";
import type {
  ConversationDraftPanelState,
  ConversationWorkspaceDetail,
  InboxConversationListItem,
} from "@/lib/conversations/models";

type InboxWorkspaceProps = {
  conversations: InboxConversationListItem[];
  selectedConversationId?: string | null;
  selectedConversation: ConversationWorkspaceDetail | null;
  missingConversation?: boolean;
};

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
            <strong>{draft.label}</strong>
            <p className="body-copy">{draft.body}</p>
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

function renderWorkspacePlaceholder(conversations: InboxConversationListItem[], missingConversation: boolean) {
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
    return (
      <article className="meta-card stack">
        <div>
          <p className="eyebrow">Inbox empty</p>
          <h2 className="section-title">No guest conversations yet</h2>
        </div>
        <p className="body-copy">
          Once PH1-03 ingestion receives Telegram guest messages, conversations will appear here for staff review.
        </p>
        <p className="body-copy">
          If you are setting up the pipeline, check the Telegram settings page and deliver a supported text message first.
        </p>
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
  conversations,
  selectedConversationId,
  selectedConversation,
  missingConversation = false,
}: InboxWorkspaceProps) {
  const draftPanel = selectedConversation?.draftPanel ?? {
    state: "not_available_yet" as const,
    title: "Draft area reserved",
    message: "Select a conversation to see the draft placeholder that PH1-08 will later populate.",
  };

  return (
    <div className="inbox-layout">
      <aside className="inbox-pane inbox-list-pane">
        <div className="inbox-pane-header">
          <div>
            <p className="eyebrow">PH1-04</p>
            <h2 className="section-title">Inbox</h2>
          </div>
          <span className="inbox-count">{conversations.length}</span>
        </div>
        {conversations.length === 0 ? (
          <article className="meta-card stack">
            <h3 className="section-title">No conversations</h3>
            <p className="body-copy">Guest threads will appear here after Telegram ingestion stores inbound messages.</p>
          </article>
        ) : (
          <div className="conversation-list">
            {conversations.map((conversation) => {
              const isSelected = selectedConversationId === conversation.id;
              return (
                <Link
                  className={`conversation-row${isSelected ? " conversation-row-selected" : ""}`}
                  href={`/dashboard/inbox/${conversation.id}`}
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
                    {selectedConversation.conversation.assignedHotelUserId ?? "Unassigned"}
                  </p>
                </div>
              </div>
            </article>

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
          renderWorkspacePlaceholder(conversations, missingConversation)
        )}
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
