import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { getAccessContext } from "@/lib/auth/server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getAccessContext();
  const hotelLabel = access.kind === "hotel_user" ? access.hotelName ?? access.hotelId : "Internal support";

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div>
            <p className="eyebrow">{access.kind === "hotel_user" ? "Tenant-safe dashboard" : "Internal support"}</p>
            <strong>{hotelLabel}</strong>
          </div>
          <nav className="dashboard-nav">
            {access.kind === "hotel_user" ? (
              <>
                <Link href="/dashboard">Overview</Link>
                <Link href="/dashboard/inbox">Inbox</Link>
                {access.hotelRole === "hotel_admin" ? <Link href="/dashboard/knowledge">Knowledge</Link> : null}
                <Link href="/dashboard/settings/telegram">Telegram</Link>
              </>
            ) : (
              <Link href="/dashboard/settings/telegram">Telegram support</Link>
            )}
          </nav>
        </div>
        <form action={signOutAction}>
          <button className="button secondary-button" type="submit">
            Sign out
          </button>
        </form>
      </header>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
