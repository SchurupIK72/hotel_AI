"use client";

type InboxErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function InboxError({ reset }: InboxErrorProps) {
  return (
    <section className="stack">
      <div>
        <p className="eyebrow">Inbox error</p>
        <h1 className="title">Conversation workspace could not be loaded</h1>
        <p className="body-copy">
          The workspace hit a sanitized server error. Try reloading the segment or revisit the page after checking the data path.
        </p>
      </div>
      <button className="button" onClick={() => reset()} type="button">
        Retry inbox load
      </button>
    </section>
  );
}
