function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  return value;
}

export function getSupabaseAnonKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return value;
}

export function getSupabaseServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getAppBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
}

export function getTelegramTokenEncryptionSecret() {
  return requireEnv("TELEGRAM_TOKEN_ENCRYPTION_SECRET");
}

export function getSuperAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}
