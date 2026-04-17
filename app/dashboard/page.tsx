import Link from "next/link";
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
      <article className="meta-card stack">
        <div>
          <p className="eyebrow">PH1-04</p>
          <h2 className="section-title">Conversation workspace is available</h2>
        </div>
        <p className="body-copy">
          Open the inbox to review tenant-scoped guest conversations, message history, and the draft placeholder panel.
        </p>
        <div>
          <Link className="button dashboard-link-button" href="/dashboard/inbox">
            Open inbox
          </Link>
        </div>
      </article>
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
