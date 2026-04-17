import { InboxWorkspace } from "@/components/inbox/workspace";
import { notFound } from "next/navigation";
import { resolveInboxFilter } from "@/lib/conversations/models";
import { getConversationWorkspace, listInboxConversations } from "@/lib/conversations/workspace";
import { requireHotelUser } from "@/lib/auth/guards";

type ConversationWorkspacePageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams?: Promise<{
    filter?: string;
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
  const [conversations, selectedConversation] = await Promise.all([
    listInboxConversations(access.hotelId, {
      filter: currentFilter,
      currentHotelUserId: access.hotelUserId,
    }),
    getConversationWorkspace(access.hotelId, conversationId),
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
        conversations={conversations}
        currentFilter={currentFilter}
        selectedConversation={selectedConversation}
        selectedConversationId={selectedConversation.conversation.id}
      />
    </section>
  );
}
