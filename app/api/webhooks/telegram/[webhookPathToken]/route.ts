import { handleTelegramWebhookPost } from "@/lib/telegram/webhook-route";

type RouteParams = {
  params: Promise<{
    webhookPathToken: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { webhookPathToken } = await params;
  return handleTelegramWebhookPost(request, webhookPathToken);
}
