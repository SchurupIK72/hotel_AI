import assert from "node:assert/strict";
import {
  createConversationWorkspaceDetail,
  createDraftPanelState,
  createInboxConversationListItem,
  resolveSelectedConversationId,
} from "../../lib/conversations/models.ts";

try {
  const inboxItem = createInboxConversationListItem(
    {
      id: "conversation-1",
      guest_id: "guest-1",
      channel: "telegram",
      status: "open",
      mode: "copilot_mode",
      assigned_hotel_user_id: null,
      last_message_preview: "Need airport transfer details",
      last_message_at: "2026-04-17T08:30:00.000Z",
      last_inbound_message_at: "2026-04-17T08:30:00.000Z",
      unread_count: 2,
      last_ai_draft_at: null,
    },
    {
      id: "guest-1",
      display_name: null,
      telegram_username: "traveler",
      first_name: "Jane",
      last_name: "Doe",
      language_code: "en",
      last_message_at: "2026-04-17T08:30:00.000Z",
    },
  );

  assert.equal(inboxItem.guestDisplayName, "Jane Doe");
  assert.equal(inboxItem.guestHandle, "@traveler");
  assert.equal(inboxItem.lastMessagePreview, "Need airport transfer details");
  assert.equal(resolveSelectedConversationId([inboxItem]), "conversation-1");
  assert.equal(resolveSelectedConversationId([inboxItem], "conversation-1"), "conversation-1");
  assert.equal(resolveSelectedConversationId([inboxItem], "missing-conversation"), "conversation-1");
  assert.equal(resolveSelectedConversationId([]), null);

  const placeholderDraft = createDraftPanelState();
  assert.deepEqual(placeholderDraft, {
    state: "not_available_yet",
    title: "AI drafts are not wired yet",
    message:
      "PH1-04 reserves this panel so PH1-08 can attach generated drafts without redesigning the workspace.",
  });

  assert.deepEqual(createDraftPanelState({ state: "empty" }), {
    state: "empty",
    title: "No drafts yet",
    message: "This conversation does not have stored drafts yet.",
  });

  assert.deepEqual(
    createDraftPanelState({
      drafts: [
        {
          id: "draft-1",
          generationId: "generation-1",
          hotelId: "hotel-1",
          conversationId: "conversation-1",
          messageId: "message-1",
          draftIndex: 1,
          draftText: "Breakfast is served from 07:00 to 10:30.",
          sourceType: "kb",
          status: "generated",
          retrievalRefs: [],
          modelName: "gpt-phase1",
          confidenceLabel: "knowledge-backed",
          createdAt: "2026-04-18T09:00:00.000Z",
        },
      ],
    }),
    {
      state: "ready",
      title: "Latest AI drafts",
      drafts: [
        {
          id: "draft-1",
          label: "Draft 1",
          body: "Breakfast is served from 07:00 to 10:30.",
          confidenceLabel: "knowledge-backed",
          createdAt: "2026-04-18T09:00:00.000Z",
          modelName: "gpt-phase1",
          sourceType: "kb",
        },
      ],
    },
  );

  assert.deepEqual(createDraftPanelState({ errorMessage: "temporary failure" }), {
    state: "error",
    title: "Draft panel unavailable",
    message: "temporary failure",
  });

  const detail = createConversationWorkspaceDetail({
    conversation: {
      id: "conversation-1",
      guest_id: "guest-1",
      channel: "telegram",
      status: "open",
      mode: "copilot_mode",
      assigned_hotel_user_id: "hotel-user-1",
      subject: null,
      last_message_preview: null,
      last_message_at: "2026-04-17T08:30:00.000Z",
      last_inbound_message_at: "2026-04-17T08:30:00.000Z",
      unread_count: 1,
      last_ai_draft_at: null,
      created_at: "2026-04-17T08:00:00.000Z",
    },
    guest: {
      id: "guest-1",
      display_name: "Jane Doe",
      telegram_username: "traveler",
      first_name: "Jane",
      last_name: "Doe",
      language_code: "en",
      last_message_at: "2026-04-17T08:30:00.000Z",
    },
    messages: [
      {
        id: "message-1",
        conversation_id: "conversation-1",
        guest_id: "guest-1",
        direction: "inbound",
        message_type: "text",
        text_body: "Hello",
        created_at: "2026-04-17T08:01:00.000Z",
        delivered_at: "2026-04-17T08:01:00.000Z",
      },
      {
        id: "message-2",
        conversation_id: "conversation-1",
        guest_id: null,
        direction: "outbound",
        message_type: "text",
        text_body: "Hi there",
        created_at: "2026-04-17T08:02:00.000Z",
        delivered_at: "2026-04-17T08:02:00.000Z",
      },
    ],
  });

  assert.equal(detail.conversation.lastMessagePreview, "No messages yet");
  assert.equal(detail.guest.displayName, "Jane Doe");
  assert.deepEqual(
    detail.messages.map((message) => message.id),
    ["message-1", "message-2"],
  );

  console.log("PH1-04 helper checks passed.");
} catch (error) {
  console.error("PH1-04 helper checks failed.");
  throw error;
}
