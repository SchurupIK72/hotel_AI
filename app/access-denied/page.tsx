export default function AccessDeniedPage() {
  return (
    <main className="centered-card-layout">
      <section className="card stack">
        <p className="eyebrow">Access denied</p>
        <h1 className="title">Your account does not have hotel access</h1>
        <p className="body-copy">
          This dashboard requires an active hotel staff membership. Ask an
          administrator to check your role or activation status.
        </p>
      </section>
    </main>
  );
}

