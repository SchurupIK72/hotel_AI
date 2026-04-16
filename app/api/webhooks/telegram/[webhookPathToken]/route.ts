import { NextResponse } from "next/server";
import { getTelegramIntegrationByWebhookPathToken } from "@/lib/telegram/integrations";
import { processTelegramInboundUpdate } from "@/lib/telegram/inbound";
import { createEventLogSafely } from "@/lib/events/event-logs";

type RouteParams = {
  params: Promise<{
    webhookPathToken: string;
  }>;
};

function unauthorizedResponse() {
  return NextResponse.json(
    { ok: false, error: "Webhook secret mismatch." },
    { status: 401 },
  );
}

export async function POST(request: Request, { params }: RouteParams) {
  const { webhookPathToken } = await params;
  const integration = await getTelegramIntegrationByWebhookPathToken(webhookPathToken);

  if (!integration) {
    await createEventLogSafely({
      eventType: "telegram_webhook_rejected",
      payload: { reason: "webhook_target_not_found", webhook_path_token: webhookPathToken },
    });
    return NextResponse.json({ ok: false, error: "Webhook target not found." }, { status: 404 });
  }

  if (!integration.is_active) {
    await createEventLogSafely({
      hotelId: integration.hotel_id,
      integrationId: integration.id,
      eventType: "telegram_webhook_rejected",
      payload: { reason: "inactive_integration" },
    });
    return NextResponse.json({ ok: false, error: "Integration is inactive." }, { status: 410 });
  }

  if (integration.webhook_secret) {
    const providedSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (providedSecret !== integration.webhook_secret) {
      await createEventLogSafely({
        hotelId: integration.hotel_id,
        integrationId: integration.id,
        eventType: "telegram_webhook_rejected",
        payload: { reason: "webhook_secret_mismatch" },
      });
      return unauthorizedResponse();
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    await createEventLogSafely({
      hotelId: integration.hotel_id,
      integrationId: integration.id,
      eventType: "telegram_webhook_rejected",
      payload: { reason: "malformed_payload" },
    });
    return NextResponse.json({ ok: false, error: "Malformed Telegram payload." }, { status: 400 });
  }

  try {
    await createEventLogSafely({
      hotelId: integration.hotel_id,
      integrationId: integration.id,
      eventType: "telegram_webhook_received",
      payload:
        payload && typeof payload === "object" && "update_id" in payload
          ? { update_id: (payload as { update_id?: number }).update_id ?? null }
          : {},
    });

    const result = await processTelegramInboundUpdate(
      {
        integrationId: integration.id,
        hotelId: integration.hotel_id,
        channel: "telegram",
        botUsername: integration.bot_username,
        webhookPathToken: integration.webhook_path_token,
        isActive: true,
      },
      payload as Record<string, unknown>,
    );

    return NextResponse.json({
      ok: true,
      status: result.status,
      reason: "reason" in result ? result.reason : undefined,
      conversationId: "conversationId" in result ? result.conversationId : undefined,
      messageId: "messageId" in result ? result.messageId : undefined,
    });
  } catch {
    await createEventLogSafely({
      hotelId: integration.hotel_id,
      integrationId: integration.id,
      eventType: "telegram_webhook_rejected",
      payload: { reason: "ingestion_failed" },
    });
    return NextResponse.json({ ok: false, error: "Inbound message ingestion failed." }, { status: 500 });
  }
}
