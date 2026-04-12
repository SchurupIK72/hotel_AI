import { requireHotelUser } from "@/lib/auth/guards";

export default async function DashboardPage() {
  const access = await requireHotelUser();

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">Phase 1 foundation</p>
        <h1 className="title">Dashboard shell is protected</h1>
        <p className="body-copy">
          This page confirms that staff authentication, hotel membership
          resolution, and tenant-safe access context are working together.
        </p>
      </div>
      <div className="meta-grid">
        <article className="meta-card">
          <h2>User</h2>
          <p className="body-copy mono">{access.authUserId}</p>
        </article>
        <article className="meta-card">
          <h2>Hotel</h2>
          <p className="body-copy mono">{access.hotelId}</p>
        </article>
        <article className="meta-card">
          <h2>Hotel user</h2>
          <p className="body-copy mono">{access.hotelUserId}</p>
        </article>
        <article className="meta-card">
          <h2>Role</h2>
          <p className="body-copy mono">{access.hotelRole}</p>
        </article>
      </div>
    </section>
  );
}

