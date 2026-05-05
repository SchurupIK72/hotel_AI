"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  clearConversationDraftSelectionAction,
  sendConversationReplyAction,
} from "@/app/dashboard/inbox/actions";
import type { InboxFilter, ReplySendState } from "@/lib/conversations/models";

type ReplyComposerFormProps = {
  conversationId: string;
  currentFilter: InboxFilter;
  disabledReason: string | null;
  initialReplyText: string;
  operationKey: string;
  resetReplyHref: string | null;
  selectedDraftId: string | null;
  sendState: ReplySendState;
  source: "manual" | "draft";
};

function SubmitReplyButton({
  baseDisabled,
  sendState,
}: {
  baseDisabled: boolean;
  sendState: ReplySendState;
}) {
  const { pending } = useFormStatus();
  const label = pending ? "Sending..." : sendState === "failed_retryable" ? "Retry reply" : "Send reply";

  return (
    <button className="button" disabled={baseDisabled || pending} type="submit">
      {label}
    </button>
  );
}

export function ReplyComposerForm({
  conversationId,
  currentFilter,
  disabledReason,
  initialReplyText,
  operationKey,
  resetReplyHref,
  selectedDraftId,
  sendState,
  source,
}: ReplyComposerFormProps) {
  const [replyText, setReplyText] = useState(initialReplyText);

  useEffect(() => {
    setReplyText(initialReplyText);
  }, [initialReplyText]);

  const trimmedReplyText = replyText.trim();
  const isAmbiguousFailure = sendState === "failed_ambiguous";
  const baseDisabled = disabledReason != null || trimmedReplyText.length === 0;

  return (
    <form action={sendConversationReplyAction} className="control-form">
      <input name="conversationId" type="hidden" value={conversationId} />
      <input name="filter" type="hidden" value={currentFilter} />
      <input name="selectedDraftId" type="hidden" value={selectedDraftId ?? ""} />
      <input name="operationKey" type="hidden" value={operationKey} />
      <label className="label-stack">
        <span>Final reply text</span>
        <textarea
          className="input reply-composer-textarea"
          name="replyText"
          onChange={(event) => setReplyText(event.target.value)}
          required
          rows={8}
          value={replyText}
        />
      </label>
      <div className="draft-meta-stack">
        <p className="conversation-meta mono">
          Source: {source === "draft" ? `Draft-backed (${selectedDraftId})` : "Manual reply"}
        </p>
        <p className="conversation-meta mono">Channel: Telegram text only</p>
      </div>
      <div className="reply-composer-actions">
        {selectedDraftId ? (
          <button className="button secondary-button" formAction={clearConversationDraftSelectionAction}>
            Write manually
          </button>
        ) : null}
        {isAmbiguousFailure && resetReplyHref ? (
          <Link className="button secondary-button" href={resetReplyHref}>
            Prepare a new send attempt
          </Link>
        ) : null}
        <SubmitReplyButton baseDisabled={baseDisabled} sendState={sendState} />
      </div>
    </form>
  );
}
