import { signOutAction } from "@/app/(auth)/actions";
import { requireHotelUser } from "@/lib/auth/guards";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await requireHotelUser();

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Tenant-safe dashboard</p>
          <strong>{access.hotelName ?? access.hotelId}</strong>
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

