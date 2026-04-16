import assert from "node:assert/strict";
import { parseTelegramInboundUpdate } from "../../lib/telegram/inbound.ts";

const integration = {
  integrationId: "integration-1",
  hotelId: "hotel-1",
  channel: "telegram" as const,
  botUsername: "hotel_bot",
  webhookPathToken: "token-1",
  isActive: true as const,
};

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

  console.log("PH1-03 helper checks passed.");
} catch (error) {
  console.error("PH1-03 helper checks failed.");
  throw error;
}
