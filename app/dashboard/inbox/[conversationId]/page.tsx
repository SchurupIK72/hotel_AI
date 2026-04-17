import { InboxWorkspace } from "@/components/inbox/workspace";
import { notFound } from "next/navigation";
import { resolveInboxFilter } from "@/lib/conversations/models";
import { listAssignableHotelUsers } from "@/lib/conversations/operations";
import { getConversationWorkspace, listInboxConversations } from "@/lib/conversations/workspace";
import { requireHotelUser } from "@/lib/auth/guards";

type ConversationWorkspacePageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams?: Promise<{
    filter?: string;
    operationStatus?: string;
    message?: string;
  }>;
};

export default async function ConversationWorkspacePage({
  params,
  searchParams,
}: ConversationWorkspacePageProps) {
  const access = await requireHotelUser();
  const { conversationId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const currentFilter = resolveInboxFilter(resolvedSearchParams?.filter);
  const [conversations, selectedConversation, assignableHotelUsers] = await Promise.all([
    listInboxConversations(access.hotelId, {
      filter: currentFilter,
      currentHotelUserId: access.hotelUserId,
    }),
    getConversationWorkspace(access.hotelId, conversationId),
    listAssignableHotelUsers(access.hotelId),
  ]);

  if (!selectedConversation) {
    notFound();
  }

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">PH1-04</p>
        <h1 className="title">Conversation workspace</h1>
        <p className="body-copy">
          Review tenant-scoped guest history, normalized conversation metadata, and the reserved draft panel from one screen.
        </p>
      </div>
      <InboxWorkspace
        assignableHotelUsers={assignableHotelUsers}
        conversations={conversations}
        currentFilter={currentFilter}
        currentHotelUserId={access.hotelUserId}
        operationMessage={resolvedSearchParams?.message ?? null}
        operationStatus={
          resolvedSearchParams?.operationStatus === "error"
            ? "error"
            : resolvedSearchParams?.operationStatus === "saved"
              ? "saved"
              : null
        }
        selectedConversation={selectedConversation}
        selectedConversationId={selectedConversation.conversation.id}
      />
    </section>
  );
}
