import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret } from "../lib/security/secrets.ts";
import {
  deactivateTelegramIntegration,
  getActiveTelegramIntegration,
  getTelegramClientConfig,
  listTelegramIntegrationsForHotel,
} from "../lib/telegram/integrations.ts";
import type { Database } from "../types/database.ts";

type InsertedIntegrationRow = {
  id: string;
  name: string;
};

const envPath = path.join(process.cwd(), ".env.local");
const smokeHotelIdFallback = "33333333-3333-3333-3333-333333333333";

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {} as Record<string, string>;
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
      }),
  );
}

function requireEnv(env: Record<string, string | undefined>, name: string) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function cleanupSmokeIntegrations(
  supabase: ReturnType<typeof createClient<Database>>,
  hotelId: string,
) {
  await supabase
    .from("channel_integrations")
    .delete()
    .eq("hotel_id", hotelId)
    .like("name", "PH1-02 smoke%");
}

async function upsertSmokeHotel(
  supabase: ReturnType<typeof createClient<Database>>,
  hotelId: string,
) {
  const { error } = await supabase.from("hotels").upsert({
    id: hotelId,
    name: "PH1-02 Smoke Hotel",
    slug: "ph1-02-smoke-hotel",
    default_language: "en",
    timezone: "Europe/Moscow",
  } as never);

  if (error) throw error;
}

async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  process.env.SUPABASE_SERVICE_ROLE_KEY = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  process.env.TELEGRAM_TOKEN_ENCRYPTION_SECRET = requireEnv(env, "TELEGRAM_TOKEN_ENCRYPTION_SECRET");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hotelId = env.PH1_02_SMOKE_HOTEL_ID ?? smokeHotelIdFallback;
  const activeToken = "123456:ph1-02-active-telegram-token";
  const inactiveToken = "654321:ph1-02-inactive-telegram-token";

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await upsertSmokeHotel(supabase, hotelId);
  await cleanupSmokeIntegrations(supabase, hotelId);

  const { data: insertedRows, error: insertError } = await supabase
    .from("channel_integrations")
    .insert([
      {
        hotel_id: hotelId,
        channel: "telegram",
        name: "PH1-02 smoke active",
        bot_token_encrypted: encryptSecret(activeToken),
        bot_username: "ph1_02_active_bot",
        webhook_secret: "smoke-secret",
        webhook_path_token: "ph1-02-smoke-active-token",
        is_active: true,
        last_verified_at: "2026-04-19T09:00:00.000Z",
      },
      {
        hotel_id: hotelId,
        channel: "telegram",
        name: "PH1-02 smoke inactive",
        bot_token_encrypted: encryptSecret(inactiveToken),
        bot_username: "ph1_02_inactive_bot",
        webhook_secret: "smoke-secret-inactive",
        webhook_path_token: "ph1-02-smoke-inactive-token",
        is_active: false,
        last_error_at: "2026-04-19T08:00:00.000Z",
        last_error_code: "telegram_401",
        last_error_message: "Unauthorized",
      },
    ] as never)
    .select("id, name");
  if (insertError) throw insertError;

  const insertedIntegrationRows = ((insertedRows ?? []) as InsertedIntegrationRow[]);
  const activeRow = insertedIntegrationRows.find((row) => row.name === "PH1-02 smoke active");
  const inactiveRow = insertedIntegrationRows.find((row) => row.name === "PH1-02 smoke inactive");
  if (!activeRow || !inactiveRow) {
    throw new Error("Expected PH1-02 smoke integrations to be inserted.");
  }

  const summaries = await listTelegramIntegrationsForHotel(hotelId);
  assert.equal(summaries.length, 2);
  assert.equal(summaries.some((summary) => summary.name === "PH1-02 smoke active"), true);
  assert.equal(summaries.some((summary) => summary.name === "PH1-02 smoke inactive"), true);
  assert.equal(summaries.every((summary) => !("botToken" in summary)), true);
  assert.equal(summaries.every((summary) => !("botTokenEncrypted" in summary)), true);
  assert.equal(summaries.every((summary) => !("webhookSecret" in summary)), true);

  const activeIntegration = await getActiveTelegramIntegration(hotelId);
  assert.equal(activeIntegration?.integrationId, activeRow.id);
  assert.equal(activeIntegration?.botUsername, "ph1_02_active_bot");

  const clientConfig = await getTelegramClientConfig({ hotelId });
  assert.equal(clientConfig.integrationId, activeRow.id);
  assert.equal(clientConfig.botToken, activeToken);
  assert.equal(clientConfig.botUsername, "ph1_02_active_bot");

  const didDeactivate = await deactivateTelegramIntegration(hotelId);
  assert.equal(didDeactivate, true);

  const noActiveIntegration = await getActiveTelegramIntegration(hotelId);
  assert.equal(noActiveIntegration, null);

  await assert.rejects(
    () => getTelegramClientConfig({ integrationId: activeRow.id }),
    (error) => error instanceof Error && error.message === "The Telegram integration is inactive.",
  );

  await assert.rejects(
    () => getTelegramClientConfig({ hotelId }),
    (error) =>
      error instanceof Error &&
      error.message === "No active Telegram integration is configured for this hotel.",
  );

  await cleanupSmokeIntegrations(supabase, hotelId);

  console.log("PH1-02 smoke verification passed.");
  console.log(`hotel=${hotelId} active=${activeRow.id} inactive=${inactiveRow.id}`);
}

main().catch((error) => {
  console.error("PH1-02 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
