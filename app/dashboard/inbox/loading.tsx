export default function InboxLoading() {
  return (
    <section className="stack">
      <div>
        <p className="eyebrow">PH1-04</p>
        <h1 className="title">Loading conversation workspace</h1>
        <p className="body-copy">Fetching tenant-safe inbox data for the current hotel.</p>
      </div>
      <div className="inbox-layout">
        <div className="inbox-pane meta-card loading-block" />
        <div className="inbox-pane meta-card loading-block" />
        <div className="inbox-pane meta-card loading-block" />
      </div>
    </section>
  );
}
