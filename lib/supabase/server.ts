import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const mutableCookieStore = cookieStore as typeof cookieStore & {
    set: (name: string, value: string, options?: CookieOptions) => void;
  };

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: CookieOptions;
        }>,
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            mutableCookieStore.set(name, value, options);
          } catch {
            // Server Components can read cookies but may not be allowed to mutate them.
          }
        });
      },
    },
  });
}
