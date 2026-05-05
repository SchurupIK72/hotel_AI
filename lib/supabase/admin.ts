import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "../env.ts";
import type { Database } from "../../types/database.ts";

export function createServiceRoleSupabaseClient() {
  return createClient<Database>(getSupabaseServerUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
