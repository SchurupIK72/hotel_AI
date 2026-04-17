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
type HotelUserRow = Database["public"]["Tables"]["hotel_users"]["Row"];

export type AssignableHotelUser = Pick<HotelUserRow, "id" | "auth_user_id" | "role" | "full_name">;

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

export async function listActiveHotelUsersByHotelId(supabase: DatabaseClient, hotelId: string) {
  const { data, error } = await supabase
    .from("hotel_users")
    .select("id, auth_user_id, role, full_name")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AssignableHotelUser[]).sort((left, right) =>
    (left.full_name ?? "").localeCompare(right.full_name ?? "", "en"),
  );
}

export async function findActiveHotelUserById(
  supabase: DatabaseClient,
  hotelId: string,
  hotelUserId: string,
) {
  const { data, error } = await supabase
    .from("hotel_users")
    .select("id, auth_user_id, role, full_name")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .eq("id", hotelUserId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AssignableHotelUser | null) ?? null;
}
