import assert from "node:assert/strict";
import { parseTelegramInboundUpdate } from "../../lib/telegram/inbound.ts";
import { handleTelegramWebhookPost } from "../../lib/telegram/webhook-route.ts";
import {
  createMalformedPayloadRejection,
  mapTelegramWebhookSuccess,
  validateTelegramWebhookRequest,
} from "../../lib/telegram/webhook.ts";

const integration = {
  integrationId: "integration-1",
  hotelId: "hotel-1",
  channel: "telegram" as const,
  botUsername: "hotel_bot",
  webhookPathToken: "token-1",
  isActive: true as const,
};

type RouteIntegrationRecord = {
  id: string;
  hotel_id: string;
  bot_username: string | null;
  webhook_path_token: string;
  webhook_secret: string | null;
  is_active: boolean;
};

function createRouteIntegration(overrides: Partial<RouteIntegrationRecord> = {}): RouteIntegrationRecord {
  return {
    id: "integration-1",
    hotel_id: "hotel-1",
    bot_username: "hotel_bot",
    webhook_path_token: "token-1",
    webhook_secret: "secret-1",
    is_active: true,
    ...overrides,
  };
}

try {
  const parsed = parseTelegramInboundUpdate(integration, {
    update_id: 501,
    message: {
      message_id: 77,
      date: 1_710_000_000,
      text: "Hello, I need late check-in info",
      chat: { id: 9001 },
      from: {
        id: 42,
        username: "guest_user",
        first_name: "Jane",
        last_name: "Doe",
        language_code: "en",
      },
    },
  });

  assert.ok(!("ignored" in parsed));
  assert.equal(parsed.externalMessageId, "9001:77");
  assert.equal(parsed.externalChatId, "9001");
  assert.equal(parsed.senderExternalId, "42");
  assert.equal(parsed.telegramUser.username, "guest_user");

  assert.deepEqual(parseTelegramInboundUpdate(integration, { update_id: 1 }), {
    ignored: true,
    reason: "unsupported_update_type",
  });

  assert.deepEqual(
    parseTelegramInboundUpdate(integration, {
      update_id: 2,
      message: { message_id: 10, chat: { id: 11 }, from: { id: 12 } },
    }),
    {
      ignored: true,
      reason: "missing_text_body",
    },
  );

  assert.deepEqual(
    validateTelegramWebhookRequest({
      integration: null,
      providedSecret: null,
    }),
    {
      ok: false,
      status: 404,
      error: "Webhook target not found.",
      reason: "webhook_target_not_found",
    },
  );

  assert.deepEqual(
    validateTelegramWebhookRequest({
      integration: {
        id: "integration-1",
        hotel_id: "hotel-1",
        bot_username: "hotel_bot",
        webhook_path_token: "token-1",
        webhook_secret: "secret-1",
        is_active: false,
      },
      providedSecret: "secret-1",
    }),
    {
      ok: false,
      status: 410,
      error: "Integration is inactive.",
      reason: "inactive_integration",
    },
  );

  assert.deepEqual(
    validateTelegramWebhookRequest({
      integration: {
        id: "integration-1",
        hotel_id: "hotel-1",
        bot_username: "hotel_bot",
        webhook_path_token: "token-1",
        webhook_secret: "secret-1",
        is_active: true,
      },
      providedSecret: "wrong-secret",
    }),
    {
      ok: false,
      status: 401,
      error: "Webhook secret mismatch.",
      reason: "webhook_secret_mismatch",
    },
  );

  assert.deepEqual(createMalformedPayloadRejection(), {
    ok: false,
    status: 400,
    error: "Malformed Telegram payload.",
    reason: "malformed_payload",
  });

  assert.deepEqual(
    mapTelegramWebhookSuccess({
      ok: true,
      status: "update_ignored",
      reason: "unsupported_update_type",
    }),
    {
      ok: true,
      status: "update_ignored",
      reason: "unsupported_update_type",
      conversationId: undefined,
      messageId: undefined,
    },
  );

  const routeEvents: Array<{ eventType: string; payload?: unknown }> = [];
  const successResponse = await handleTelegramWebhookPost(
    new Request("http://localhost/api/webhooks/telegram/token-1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret-1",
      },
      body: JSON.stringify({ update_id: 9001, message: { text: "hello" } }),
    }),
    "token-1",
    {
      getIntegrationByWebhookPathToken: async () => createRouteIntegration(),
      processInboundUpdate: async () => ({
        ok: true,
        status: "update_ignored",
        reason: "unsupported_update_type",
      }),
      logEvent: async (input) => {
        routeEvents.push({ eventType: input.eventType, payload: input.payload });
      },
    },
  );

  assert.equal(successResponse.status, 200);
  assert.deepEqual(await successResponse.json(), {
    ok: true,
    status: "update_ignored",
    reason: "unsupported_update_type",
  });
  assert.deepEqual(
    routeEvents.map((entry) => entry.eventType),
    ["telegram_webhook_received"],
  );

  const invalidSecretResponse = await handleTelegramWebhookPost(
    new Request("http://localhost/api/webhooks/telegram/token-1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    }),
    "token-1",
    {
      getIntegrationByWebhookPathToken: async () => createRouteIntegration(),
      processInboundUpdate: async () => {
        throw new Error("should not run");
      },
      logEvent: async () => {},
    },
  );
  assert.equal(invalidSecretResponse.status, 401);
  assert.deepEqual(await invalidSecretResponse.json(), {
    ok: false,
    error: "Webhook secret mismatch.",
  });

  const inactiveResponse = await handleTelegramWebhookPost(
    new Request("http://localhost/api/webhooks/telegram/token-1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret-1",
      },
      body: JSON.stringify({ update_id: 1 }),
    }),
    "token-1",
    {
      getIntegrationByWebhookPathToken: async () =>
        createRouteIntegration({ is_active: false }),
      processInboundUpdate: async () => {
        throw new Error("should not run");
      },
      logEvent: async () => {},
    },
  );
  assert.equal(inactiveResponse.status, 410);
  assert.deepEqual(await inactiveResponse.json(), {
    ok: false,
    error: "Integration is inactive.",
  });

  const missingTargetResponse = await handleTelegramWebhookPost(
    new Request("http://localhost/api/webhooks/telegram/token-1", {
      method: "POST",
      body: JSON.stringify({ update_id: 1 }),
    }),
    "token-1",
    {
      getIntegrationByWebhookPathToken: async () => null,
      processInboundUpdate: async () => {
        throw new Error("should not run");
      },
      logEvent: async () => {},
    },
  );
  assert.equal(missingTargetResponse.status, 404);
  assert.deepEqual(await missingTargetResponse.json(), {
    ok: false,
    error: "Webhook target not found.",
  });

  const malformedResponse = await handleTelegramWebhookPost(
    new Request("http://localhost/api/webhooks/telegram/token-1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret-1",
      },
      body: "{not-json",
    }),
    "token-1",
    {
      getIntegrationByWebhookPathToken: async () => createRouteIntegration(),
      processInboundUpdate: async () => {
        throw new Error("should not run");
      },
      logEvent: async () => {},
    },
  );
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(await malformedResponse.json(), {
    ok: false,
    error: "Malformed Telegram payload.",
  });

  console.log("PH1-03 helper checks passed.");
} catch (error) {
  console.error("PH1-03 helper checks failed.");
  throw error;
}
