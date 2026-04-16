import { NextResponse } from "next/server.js";
import { createEventLogSafely } from "../events/event-logs.ts";
import { processTelegramInboundUpdate } from "./inbound.ts";
import { getTelegramIntegrationByWebhookPathToken } from "./integrations.ts";
import {
  createMalformedPayloadRejection,
  mapTelegramWebhookSuccess,
  type TelegramWebhookIntegrationLookup,
  validateTelegramWebhookRequest,
} from "./webhook.ts";

type TelegramWebhookRouteDependencies = {
  getIntegrationByWebhookPathToken: (
    webhookPathToken: string,
  ) => Promise<TelegramWebhookIntegrationLookup>;
  processInboundUpdate: typeof processTelegramInboundUpdate;
  logEvent: typeof createEventLogSafely;
};

const defaultDependencies: TelegramWebhookRouteDependencies = {
  getIntegrationByWebhookPathToken: getTelegramIntegrationByWebhookPathToken,
  processInboundUpdate: processTelegramInboundUpdate,
  logEvent: createEventLogSafely,
};

export async function handleTelegramWebhookPost(
  request: Request,
  webhookPathToken: string,
  dependencies: Partial<TelegramWebhookRouteDependencies> = {},
) {
  const deps = { ...defaultDependencies, ...dependencies };
  const integration = await deps.getIntegrationByWebhookPathToken(webhookPathToken);

  const validation = validateTelegramWebhookRequest({
    integration,
    providedSecret: request.headers.get("x-telegram-bot-api-secret-token"),
  });

  if (!validation.ok) {
    await deps.logEvent({
      hotelId: integration?.hotel_id ?? null,
      integrationId: integration?.id ?? null,
      eventType: "telegram_webhook_rejected",
      payload: { reason: validation.reason, webhook_path_token: webhookPathToken },
    });

    return NextResponse.json({ ok: false, error: validation.error }, { status: validation.status });
  }

  const activeIntegration = integration!;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const malformed = createMalformedPayloadRejection();
    await deps.logEvent({
      hotelId: activeIntegration.hotel_id,
      integrationId: activeIntegration.id,
      eventType: "telegram_webhook_rejected",
      payload: { reason: malformed.reason },
    });

    return NextResponse.json({ ok: false, error: malformed.error }, { status: malformed.status });
  }

  try {
    await deps.logEvent({
      hotelId: activeIntegration.hotel_id,
      integrationId: activeIntegration.id,
      eventType: "telegram_webhook_received",
      payload:
        payload && typeof payload === "object" && "update_id" in payload
          ? { update_id: (payload as { update_id?: number }).update_id ?? null }
          : {},
    });

    const result = await deps.processInboundUpdate(
      {
        integrationId: activeIntegration.id,
        hotelId: activeIntegration.hotel_id,
        channel: "telegram",
        botUsername: activeIntegration.bot_username,
        webhookPathToken: activeIntegration.webhook_path_token,
        isActive: true,
      },
      payload as Record<string, unknown>,
    );

    return NextResponse.json(mapTelegramWebhookSuccess(result));
  } catch {
    await deps.logEvent({
      hotelId: activeIntegration.hotel_id,
      integrationId: activeIntegration.id,
      eventType: "telegram_webhook_rejected",
      payload: { reason: "ingestion_failed" },
    });

    return NextResponse.json({ ok: false, error: "Inbound message ingestion failed." }, { status: 500 });
  }
}
