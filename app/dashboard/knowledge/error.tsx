"use client";

type KnowledgeErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function KnowledgeError({ reset }: KnowledgeErrorProps) {
  return (
    <section className="stack">
      <div>
        <p className="eyebrow">Knowledge error</p>
        <h1 className="title">Knowledge management could not be loaded</h1>
        <p className="body-copy">
          The knowledge workspace hit a sanitized server error. Try reloading the segment after checking the hotel-scoped data path.
        </p>
      </div>
      <button className="button" onClick={() => reset()} type="button">
        Retry knowledge load
      </button>
    </section>
  );
}
