import { InboxWorkspace } from "@/components/inbox/workspace";
import { notFound } from "next/navigation";
import { getConversationWorkspace, listInboxConversations } from "@/lib/conversations/workspace";
import { requireHotelUser } from "@/lib/auth/guards";

type ConversationWorkspacePageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

export default async function ConversationWorkspacePage({ params }: ConversationWorkspacePageProps) {
  const access = await requireHotelUser();
  const { conversationId } = await params;
  const [conversations, selectedConversation] = await Promise.all([
    listInboxConversations(access.hotelId),
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
        selectedConversation={selectedConversation}
        selectedConversationId={selectedConversation.conversation.id}
      />
    </section>
  );
}
