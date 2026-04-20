import assert from "node:assert/strict";
import { createDraftPanelState, createConversationReplyComposerState } from "../../lib/conversations/models.ts";
import { classifyOutboundSendFailure } from "../../lib/conversations/replies.ts";
import {
  TelegramIntegrationUnavailableError,
  TelegramSendMessageError,
} from "../../lib/telegram/errors.ts";

try {
  const readyDraftPanel = createDraftPanelState({
    drafts: [
      {
        id: "draft-1",
        generationId: "generation-1",
        hotelId: "hotel-1",
        conversationId: "conversation-1",
        messageId: "message-1",
        draftIndex: 1,
        draftText: "We can arrange an airport transfer for tomorrow morning.",
        sourceType: "kb",
        status: "selected",
        retrievalRefs: [],
        modelName: "gpt-phase1",
        confidenceLabel: "knowledge-backed",
        createdAt: "2026-04-20T10:00:00.000Z",
      },
    ],
  });

  const draftComposer = createConversationReplyComposerState({
    conversationId: "conversation-1",
    draftPanel: readyDraftPanel,
    hasActiveTelegramIntegration: true,
    hasResolvableTarget: true,
  });
  assert.equal(draftComposer.selectedDraftId, "draft-1");
  assert.equal(draftComposer.source, "draft");
  assert.equal(draftComposer.editorValue, "We can arrange an airport transfer for tomorrow morning.");
  assert.equal(draftComposer.canSend, true);

  const failureComposer = createConversationReplyComposerState({
    conversationId: "conversation-1",
    draftPanel: readyDraftPanel,
    selectedDraftId: "draft-1",
    replyText: "Edited final reply",
    sendState: "failed_ambiguous",
    operationMessage: "Please verify delivery with the guest before retrying.",
    hasActiveTelegramIntegration: true,
    hasResolvableTarget: true,
  });
  assert.equal(failureComposer.editorValue, "Edited final reply");
  assert.equal(failureComposer.errorMessage, "Please verify delivery with the guest before retrying.");

  const disabledComposer = createConversationReplyComposerState({
    conversationId: "conversation-1",
    draftPanel: readyDraftPanel,
    hasActiveTelegramIntegration: false,
    hasResolvableTarget: true,
  });
  assert.equal(disabledComposer.canSend, false);
  assert.match(disabledComposer.disabledReason ?? "", /active Telegram integration/i);

  assert.deepEqual(classifyOutboundSendFailure(new TelegramIntegrationUnavailableError()), {
    failureType: "retryable",
    message: "No active Telegram integration is configured for this hotel.",
  });

  assert.deepEqual(
    classifyOutboundSendFailure(new TelegramSendMessageError("rejected", "Telegram rejected the reply.")),
    {
      failureType: "retryable",
      message: "Telegram rejected the reply.",
    },
  );

  assert.deepEqual(
    classifyOutboundSendFailure(
      new TelegramSendMessageError("ambiguous", "Telegram delivery outcome could not be confirmed."),
    ),
    {
      failureType: "ambiguous",
      message: "Telegram delivery outcome could not be confirmed.",
    },
  );

  console.log("PH1-09 helper checks passed.");
} catch (error) {
  console.error("PH1-09 helper checks failed.");
  throw error;
}
