import { NextResponse } from "next/server";
import { getTelegramIntegrationByWebhookPathToken } from "@/lib/telegram/integrations";
import { processTelegramInboundUpdate } from "@/lib/telegram/inbound";

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
    return NextResponse.json({ ok: false, error: "Webhook target not found." }, { status: 404 });
  }

  if (!integration.is_active) {
    return NextResponse.json({ ok: false, error: "Integration is inactive." }, { status: 410 });
  }

  if (integration.webhook_secret) {
    const providedSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (providedSecret !== integration.webhook_secret) {
      return unauthorizedResponse();
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed Telegram payload." }, { status: 400 });
  }

  try {
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
    return NextResponse.json({ ok: false, error: "Inbound message ingestion failed." }, { status: 500 });
  }
}
