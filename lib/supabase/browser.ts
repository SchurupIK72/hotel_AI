"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}

