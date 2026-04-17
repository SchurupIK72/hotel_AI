import { InboxWorkspace } from "@/components/inbox/workspace";
import { resolveInboxFilter, resolveSelectedConversationId } from "@/lib/conversations/models";
import { getConversationWorkspace, listInboxConversations } from "@/lib/conversations/workspace";
import { requireHotelUser } from "@/lib/auth/guards";

type InboxPageProps = {
  searchParams?: Promise<{
    filter?: string;
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
  const selectedConversation = selectedConversationId
    ? await getConversationWorkspace(access.hotelId, selectedConversationId)
    : null;

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">PH1-04</p>
        <h1 className="title">Conversation workspace</h1>
        <p className="body-copy">
          Review guest conversations, inspect timeline history, and keep a stable area ready for future AI drafts.
        </p>
      </div>
      <InboxWorkspace
        conversations={conversations}
        currentFilter={currentFilter}
        selectedConversation={selectedConversation}
        selectedConversationId={selectedConversationId}
      />
    </section>
  );
}
