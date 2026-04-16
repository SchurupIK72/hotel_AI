import { NextResponse } from "next/server";
import { getTelegramIntegrationByWebhookPathToken } from "@/lib/telegram/integrations";

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

  return NextResponse.json({
    ok: true,
    status: "reserved_endpoint_only",
    message: "Webhook endpoint is reserved and validated only. Inbound message ingestion will be implemented in PH1-03.",
  });
}
