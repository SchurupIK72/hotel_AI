import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { processTelegramInboundUpdate } from "../lib/telegram/inbound.ts";

const envPath = path.join(process.cwd(), ".env.local");

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {} as Record<string, string>;

  const result: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    result[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
  }
  return result;
}

function requireEnv(env: Record<string, string | undefined>, name: string) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  const supabaseUrl = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const hotelId = env.DEMO_HOTEL_ID ?? "11111111-1111-1111-1111-111111111111";
  const externalUserId = "ph1-03-smoke-guest";
  const externalMessageId = "555000:777";

  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingGuest } = await supabase
    .from("guests")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("external_user_id", externalUserId)
    .limit(1)
    .maybeSingle();

  if (existingGuest) {
    await supabase.from("messages").delete().eq("guest_id", existingGuest.id);
    await supabase.from("conversations").delete().eq("guest_id", existingGuest.id);
    await supabase.from("guests").delete().eq("id", existingGuest.id);
  }

  await supabase
    .from("messages")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("direction", "inbound")
    .eq("external_message_id", externalMessageId);

  const payload = {
    update_id: 123456,
    message: {
      message_id: 777,
      date: 1_710_000_000,
      text: "Smoke test inbound Telegram message",
      chat: { id: 555000 },
      from: {
        id: externalUserId,
        username: "ph1_03_smoke",
        first_name: "Smoke",
        last_name: "Guest",
        language_code: "en",
      },
    },
  };

  const integration = {
    integrationId: "ph1-03-smoke-integration",
    hotelId,
    channel: "telegram" as const,
    botUsername: "smoke_bot",
    webhookPathToken: "ph1-03-smoke-webhook",
    isActive: true as const,
  };

  const firstResult = await processTelegramInboundUpdate(integration, payload);
  if (firstResult.status !== "message_ingested") {
    throw new Error(`Expected first delivery to ingest a message, got ${firstResult.status}.`);
  }

  const secondResult = await processTelegramInboundUpdate(integration, payload);
  if (secondResult.status !== "duplicate_ignored") {
    throw new Error(`Expected duplicate delivery to be ignored, got ${secondResult.status}.`);
  }

  const { data: guest } = await supabase
    .from("guests")
    .select("id, display_name")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("external_user_id", externalUserId)
    .limit(1)
    .maybeSingle();
  if (!guest) throw new Error("Expected smoke guest to be persisted.");

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, unread_count, last_message_preview, status")
    .eq("hotel_id", hotelId)
    .eq("guest_id", guest.id)
    .limit(1)
    .maybeSingle();
  if (!conversation) throw new Error("Expected conversation to be persisted.");
  if (conversation.unread_count !== 1) throw new Error("Expected unread_count to be 1 after deduped delivery.");

  const { data: messages } = await supabase
    .from("messages")
    .select("id, external_message_id, text_body")
    .eq("hotel_id", hotelId)
    .eq("guest_id", guest.id)
    .eq("direction", "inbound");
  if (!messages || messages.length !== 1) {
    throw new Error(`Expected exactly 1 inbound message row, got ${messages?.length ?? 0}.`);
  }

  console.log("PH1-03 smoke verification passed.");
  console.log(`guest=${guest.id} conversation=${conversation.id} message=${messages[0].id}`);
}

main().catch((error) => {
  console.error("PH1-03 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
