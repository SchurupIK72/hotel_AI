export default function InboxConversationNotFound() {
  return (
    <section className="stack">
      <div>
        <p className="eyebrow">Conversation not found</p>
        <h1 className="title">This conversation is not available</h1>
        <p className="body-copy">
          The requested conversation may not exist, may belong to another hotel, or may no longer be accessible from your current staff workspace.
        </p>
      </div>
    </section>
  );
}
