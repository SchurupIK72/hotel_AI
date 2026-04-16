import { randomBytes } from "node:crypto";
import { getAppBaseUrl } from "../env.ts";
import { createServiceRoleSupabaseClient } from "../supabase/admin.ts";
import { decryptSecret, encryptSecret } from "../security/secrets.ts";
import { verifyTelegramBotToken } from "./api.ts";
import { TelegramIntegrationUnavailableError } from "./errors.ts";
import type { Database } from "../../types/database.ts";

type ChannelIntegrationRow = Database["public"]["Tables"]["channel_integrations"]["Row"];
type ChannelIntegrationInsert = Database["public"]["Tables"]["channel_integrations"]["Insert"];
type ChannelIntegrationUpdate = Database["public"]["Tables"]["channel_integrations"]["Update"];
type ChannelIntegrationInsertResult = Promise<{
  data: ChannelIntegrationRow | null;
  error: Error | null;
}>;
type ChannelIntegrationMutationBuilder = {
  select(columns: string): {
    single(): ChannelIntegrationInsertResult;
  };
};

export type SaveTelegramIntegrationResult =
  | {
      ok: true;
      integration: TelegramIntegrationSummary;
      botUsername: string | null;
    }
  | {
      ok: false;
      errorCode: string;
      errorMessage: string;
    };

export type ActiveTelegramIntegration = {
  integrationId: string;
  hotelId: string;
  channel: "telegram";
  botUsername: string | null;
  webhookPathToken: string;
  isActive: true;
};

export type TelegramClientConfig = {
  integrationId: string;
  hotelId: string;
  botToken: string;
  botUsername: string | null;
};

export type TelegramIntegrationSummary = {
  integrationId: string;
  hotelId: string;
  name: string;
  botUsername: string | null;
  webhookPathToken: string;
  isActive: boolean;
  lastVerifiedAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TelegramWebhookEndpoint = {
  endpointStatus: "live_inbound_ingestion";
  webhookUrl: string;
  webhookPathToken: string;
  webhookSecretRequired: boolean;
};

function mapSummary(row: ChannelIntegrationRow): TelegramIntegrationSummary {
  return {
    integrationId: row.id,
    hotelId: row.hotel_id,
    name: row.name,
    botUsername: row.bot_username,
    webhookPathToken: row.webhook_path_token,
    isActive: row.is_active,
    lastVerifiedAt: row.last_verified_at,
    lastErrorAt: row.last_error_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWebhookPathToken() {
  return randomBytes(24).toString("hex");
}

export function buildTelegramWebhookUrl(webhookPathToken: string) {
  const baseUrl = getAppBaseUrl().replace(/\/+$/, "");
  return `${baseUrl}/api/webhooks/telegram/${webhookPathToken}`;
}

function getChannelIntegrationsTable(supabase: ReturnType<typeof createServiceRoleSupabaseClient>) {
  return supabase.from("channel_integrations") as unknown as {
    insert(values: ChannelIntegrationInsert): ChannelIntegrationMutationBuilder;
    update(values: ChannelIntegrationUpdate): {
      eq(column: "id", value: string): ChannelIntegrationMutationBuilder;
    };
  };
}

export async function listTelegramIntegrationsForHotel(hotelId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("channel_integrations")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapSummary(row as ChannelIntegrationRow));
}

export async function getActiveTelegramIntegration(hotelId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("channel_integrations")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("channel", "telegram")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as ChannelIntegrationRow;

  return {
    integrationId: row.id,
    hotelId: row.hotel_id,
    channel: "telegram",
    botUsername: row.bot_username,
    webhookPathToken: row.webhook_path_token,
    isActive: true,
  } satisfies ActiveTelegramIntegration;
}

export async function getTelegramIntegrationByWebhookPathToken(webhookPathToken: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("channel_integrations")
    .select("*")
    .eq("channel", "telegram")
    .eq("webhook_path_token", webhookPathToken)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ChannelIntegrationRow | null) ?? null;
}

export async function getTelegramWebhookEndpoint(hotelId: string) {
  const integration = await getActiveTelegramIntegration(hotelId);

  if (!integration) {
    return null;
  }

  const config = await getTelegramIntegrationByWebhookPathToken(integration.webhookPathToken);

  return {
    endpointStatus: "live_inbound_ingestion",
    webhookUrl: buildTelegramWebhookUrl(integration.webhookPathToken),
    webhookPathToken: integration.webhookPathToken,
    webhookSecretRequired: Boolean(config?.webhook_secret),
  } satisfies TelegramWebhookEndpoint;
}

export async function getTelegramClientConfig(input: { hotelId?: string; integrationId?: string }) {
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase.from("channel_integrations").select("*").eq("channel", "telegram");

  if (input.integrationId) {
    query = query.eq("id", input.integrationId);
  } else if (input.hotelId) {
    query = query.eq("hotel_id", input.hotelId).eq("is_active", true);
  } else {
    throw new TelegramIntegrationUnavailableError("Telegram integration lookup requires hotelId or integrationId.");
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new TelegramIntegrationUnavailableError();
  }

  const row = data as ChannelIntegrationRow;
  if (!row.is_active) {
    throw new TelegramIntegrationUnavailableError("The Telegram integration is inactive.");
  }

  return {
    integrationId: row.id,
    hotelId: row.hotel_id,
    botToken: decryptSecret(row.bot_token_encrypted),
    botUsername: row.bot_username,
  } satisfies TelegramClientConfig;
}

export async function createTelegramIntegration(input: {
  hotelId: string;
  name: string;
  botToken: string;
  botUsername?: string | null;
  webhookSecret?: string | null;
  createdByHotelUserId?: string | null;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const payload: ChannelIntegrationInsert = {
    hotel_id: input.hotelId,
    channel: "telegram",
    name: input.name,
    bot_token_encrypted: encryptSecret(input.botToken),
    bot_username: input.botUsername ?? null,
    webhook_secret: input.webhookSecret ?? null,
    webhook_path_token: createWebhookPathToken(),
    created_by_hotel_user_id: input.createdByHotelUserId ?? null,
  };

  const table = getChannelIntegrationsTable(supabase);
  const { data, error } = await table.insert(payload).select("*").single();

  if (error) {
    throw error;
  }

  return mapSummary(data as ChannelIntegrationRow);
}

export async function saveTelegramIntegration(input: {
  hotelId: string;
  hotelUserId: string;
  name: string;
  botToken: string;
  webhookSecret?: string | null;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const table = getChannelIntegrationsTable(supabase);
  const existing = await getActiveTelegramIntegration(input.hotelId);
  const verification = await verifyTelegramBotToken(input.botToken);
  const webhookSecret = input.webhookSecret?.trim() ? input.webhookSecret.trim() : null;

  if (!verification.ok) {
    if (existing) {
      await table
        .update({
          last_error_at: new Date().toISOString(),
          last_error_code: verification.errorCode,
          last_error_message: verification.errorMessage,
        })
        .eq("id", existing.integrationId)
        .select("*")
        .single();
    } else {
      const { error } = await table
        .insert({
          hotel_id: input.hotelId,
          channel: "telegram",
          name: input.name,
          bot_token_encrypted: encryptSecret(input.botToken),
          bot_username: null,
          webhook_secret: webhookSecret ?? null,
          webhook_path_token: createWebhookPathToken(),
          is_active: false,
          last_error_at: new Date().toISOString(),
          last_error_code: verification.errorCode,
          last_error_message: verification.errorMessage,
          created_by_hotel_user_id: input.hotelUserId,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }
    }

    return verification satisfies SaveTelegramIntegrationResult;
  }

  if (existing) {
    const currentConfig = await getTelegramClientConfig({ integrationId: existing.integrationId });
    const { data, error } = await table
      .update({
        name: input.name,
        bot_token_encrypted: encryptSecret(input.botToken),
        bot_username: verification.botUsername,
        webhook_secret: webhookSecret ?? null,
        last_verified_at: new Date().toISOString(),
        last_error_at: null,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", currentConfig.integrationId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return {
      ok: true,
      integration: mapSummary(data as ChannelIntegrationRow),
      botUsername: verification.botUsername,
    } satisfies SaveTelegramIntegrationResult;
  }

  const integration = await createTelegramIntegration({
    hotelId: input.hotelId,
    name: input.name,
    botToken: input.botToken,
    botUsername: verification.botUsername,
    webhookSecret,
    createdByHotelUserId: input.hotelUserId,
  });

  const tableUpdate = getChannelIntegrationsTable(supabase);
  const { data, error } = await tableUpdate
    .update({
      last_verified_at: new Date().toISOString(),
      last_error_at: null,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", integration.integrationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    ok: true,
    integration: mapSummary(data as ChannelIntegrationRow),
    botUsername: verification.botUsername,
  } satisfies SaveTelegramIntegrationResult;
}

export async function deactivateTelegramIntegration(hotelId: string) {
  const active = await getActiveTelegramIntegration(hotelId);

  if (!active) {
    return false;
  }

  const supabase = createServiceRoleSupabaseClient();
  const table = getChannelIntegrationsTable(supabase);
  const { error } = await table
    .update({
      is_active: false,
      last_error_at: null,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", active.integrationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return true;
}
