import { InboxWorkspace } from "@/components/inbox/workspace";
import { resolveSelectedConversationId } from "@/lib/conversations/models";
import { getConversationWorkspace, listInboxConversations } from "@/lib/conversations/workspace";
import { requireHotelUser } from "@/lib/auth/guards";

export default async function InboxPage() {
  const access = await requireHotelUser();
  const conversations = await listInboxConversations(access.hotelId);
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
        selectedConversation={selectedConversation}
        selectedConversationId={selectedConversationId}
      />
    </section>
  );
}
