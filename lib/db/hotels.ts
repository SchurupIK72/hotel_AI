import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";

export type HotelSummary = {
  id: string;
  name: string;
  slug: string;
};

export async function findHotelById(hotelId: string): Promise<HotelSummary | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("hotels")
    .select("id, name, slug")
    .eq("id", hotelId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as HotelSummary | null) ?? null;
}
