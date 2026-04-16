import type { TelegramInboundProcessResult } from "./inbound.ts";

export type TelegramWebhookIntegrationLookup =
  | {
      id: string;
      hotel_id: string;
      bot_username: string | null;
      webhook_path_token: string;
      webhook_secret: string | null;
      is_active: boolean;
    }
  | null;

export type TelegramWebhookRejection = {
  ok: false;
  status: 400 | 401 | 404 | 410;
  error: string;
  reason:
    | "webhook_target_not_found"
    | "inactive_integration"
    | "webhook_secret_mismatch"
    | "malformed_payload";
};

export function validateTelegramWebhookRequest(input: {
  integration: TelegramWebhookIntegrationLookup;
  providedSecret: string | null;
}) {
  if (!input.integration) {
    return {
      ok: false,
      status: 404,
      error: "Webhook target not found.",
      reason: "webhook_target_not_found",
    } satisfies TelegramWebhookRejection;
  }

  if (!input.integration.is_active) {
    return {
      ok: false,
      status: 410,
      error: "Integration is inactive.",
      reason: "inactive_integration",
    } satisfies TelegramWebhookRejection;
  }

  if (
    input.integration.webhook_secret &&
    input.providedSecret !== input.integration.webhook_secret
  ) {
    return {
      ok: false,
      status: 401,
      error: "Webhook secret mismatch.",
      reason: "webhook_secret_mismatch",
    } satisfies TelegramWebhookRejection;
  }

  return { ok: true as const };
}

export function createMalformedPayloadRejection() {
  return {
    ok: false,
    status: 400,
    error: "Malformed Telegram payload.",
    reason: "malformed_payload",
  } satisfies TelegramWebhookRejection;
}

export function mapTelegramWebhookSuccess(result: TelegramInboundProcessResult) {
  return {
    ok: true,
    status: result.status,
    reason: "reason" in result ? result.reason : undefined,
    conversationId: "conversationId" in result ? result.conversationId : undefined,
    messageId: "messageId" in result ? result.messageId : undefined,
  };
}
