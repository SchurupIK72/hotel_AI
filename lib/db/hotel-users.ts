import type { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ActiveHotelMembership = {
  hotelUserId: string;
  hotelId: string;
  hotelRole: "hotel_admin" | "manager";
  fullName: string | null;
  hotelName: string | null;
  hotelSlug: string | null;
};

type DatabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function findActiveHotelMembershipByAuthUserId(
  supabase: DatabaseClient,
  authUserId: string,
) {
  const { data: membershipData, error: membershipError } = await supabase
    .from("hotel_users")
    .select("id, hotel_id, role, full_name")
    .eq("auth_user_id", authUserId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  const membership =
    (membershipData as unknown as Database["public"]["Tables"]["hotel_users"]["Row"] | null) ??
    null;

  if (!membership) {
    return null;
  }

  const { data: hotelData, error: hotelError } = await supabase
    .from("hotels")
    .select("id, name, slug")
    .eq("id", membership.hotel_id)
    .limit(1)
    .maybeSingle();

  if (hotelError) {
    throw hotelError;
  }

  const hotel =
    (hotelData as unknown as Database["public"]["Tables"]["hotels"]["Row"] | null) ??
    null;

  return {
    hotelUserId: membership.id,
    hotelId: membership.hotel_id,
    hotelRole: membership.role,
    fullName: membership.full_name,
    hotelName: hotel?.name ?? null,
    hotelSlug: hotel?.slug ?? null,
  } satisfies ActiveHotelMembership;
}
