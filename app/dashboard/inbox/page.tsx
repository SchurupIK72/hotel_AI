import { randomUUID } from "node:crypto";
import { InboxWorkspace } from "@/components/inbox/workspace";
import {
  createConversationReplyComposerState,
  resolveInboxFilter,
  resolveReplySendState,
  resolveSelectedConversationId,
} from "@/lib/conversations/models";
import { listAssignableHotelUsers } from "@/lib/conversations/operations";
import { getConversationReplySupport } from "@/lib/conversations/replies";
import { getConversationWorkspace, listInboxConversations } from "@/lib/conversations/workspace";
import { requireHotelUser } from "@/lib/auth/guards";

type InboxPageProps = {
  searchParams?: Promise<{
    filter?: string;
    operationStatus?: string;
    message?: string;
    draftId?: string;
    replyText?: string;
    sendState?: string;
  }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const access = await requireHotelUser();
  const params = searchParams ? await searchParams : undefined;
  const currentFilter = resolveInboxFilter(params?.filter);
  const conversations = await listInboxConversations(access.hotelId, {
    filter: currentFilter,
    currentHotelUserId: access.hotelUserId,
  });
  const selectedConversationId = resolveSelectedConversationId(conversations);
  const [selectedConversation, assignableHotelUsers] = await Promise.all([
    selectedConversationId ? getConversationWorkspace(access.hotelId, selectedConversationId) : Promise.resolve(null),
    listAssignableHotelUsers(access.hotelId),
  ]);
  const replySupport =
    selectedConversationId && selectedConversation
      ? await getConversationReplySupport(access.hotelId, selectedConversationId)
      : null;
  const composerState =
    selectedConversation && replySupport
      ? createConversationReplyComposerState({
          conversationId: selectedConversation.conversation.id,
          draftPanel: selectedConversation.draftPanel,
          selectedDraftId: params?.draftId ?? null,
          replyText: params?.replyText ?? null,
          sendState: resolveReplySendState(params?.sendState),
          operationMessage: params?.message ?? null,
          hasActiveTelegramIntegration: replySupport.hasActiveTelegramIntegration,
          hasResolvableTarget: replySupport.hasResolvableTarget,
        })
      : null;

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">PH1-09</p>
        <h1 className="title">Conversation reply workspace</h1>
        <p className="body-copy">
          Review guest conversations, pick or ignore AI drafts, and send the final human-approved Telegram reply from one workspace.
        </p>
      </div>
      <InboxWorkspace
        assignableHotelUsers={assignableHotelUsers}
        conversations={conversations}
        currentFilter={currentFilter}
        currentHotelUserId={access.hotelUserId}
        replyComposerOperationKey={selectedConversation ? randomUUID() : null}
        replyComposerState={composerState}
        operationMessage={params?.message ?? null}
        operationStatus={params?.operationStatus === "error" ? "error" : params?.operationStatus === "saved" ? "saved" : null}
        selectedConversation={selectedConversation}
        selectedConversationId={selectedConversationId}
      />
    </section>
  );
}
