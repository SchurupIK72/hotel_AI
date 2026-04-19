import assert from "node:assert/strict";
import { AuthorizationError } from "../../lib/auth/errors.ts";
import { resolveTelegramSettingsAccessFromContext } from "../../lib/auth/telegram-settings-access.ts";
import { encryptSecret, decryptSecret } from "../../lib/security/secrets.ts";
import { sanitizeTelegramErrorMessage } from "../../lib/telegram/api.ts";
import {
  buildTelegramWebhookUrl,
  createTelegramIntegrationSummary,
  createWebhookPathToken,
  getTelegramWebhookEndpoint,
} from "../../lib/telegram/integrations.ts";

const previousSecret = process.env.TELEGRAM_TOKEN_ENCRYPTION_SECRET;
const previousAppBaseUrl = process.env.APP_BASE_URL;
process.env.TELEGRAM_TOKEN_ENCRYPTION_SECRET = "ph1-02-test-secret";
process.env.APP_BASE_URL = "https://hotel-ai.test";

function testSecretHelpers() {
  const plaintext = "123456:telegram-demo-token";
  const encrypted = encryptSecret(plaintext);
  const decrypted = decryptSecret(encrypted);
  const tokenA = createWebhookPathToken();
  const tokenB = createWebhookPathToken();

  assert.notEqual(encrypted, plaintext);
  assert.equal(decrypted, plaintext);
  assert.equal(tokenA.length, 48);
  assert.match(tokenA, /^[a-f0-9]+$/);
  assert.notEqual(tokenA, tokenB);
  assert.equal(
    sanitizeTelegramErrorMessage("Bad token 123456:ABCdef_telegram-secret-token-value"),
    "Bad token [redacted]",
  );
  assert.equal(
    buildTelegramWebhookUrl("abc123"),
    "https://hotel-ai.test/api/webhooks/telegram/abc123",
  );
  assert.equal(typeof getTelegramWebhookEndpoint, "function");
}

function testTelegramSettingsAccessResolver() {
  const hotelAdminAccess = resolveTelegramSettingsAccessFromContext(
    {
      kind: "hotel_user",
      authUserId: "auth-admin-1",
      email: "admin@example.com",
      hotelId: "hotel-1",
      hotelName: "Demo Hotel",
      hotelSlug: "demo-hotel",
      hotelUserId: "hotel-user-1",
      hotelRole: "hotel_admin",
    },
    {
      requestedHotelId: "foreign-hotel",
      targetHotel: {
        id: "foreign-hotel",
        name: "Foreign Hotel",
        slug: "foreign-hotel",
      },
    },
  );
  assert.deepEqual(hotelAdminAccess, {
    actorKind: "hotel_admin",
    authUserId: "auth-admin-1",
    hotelId: "hotel-1",
    hotelName: "Demo Hotel",
    hotelSlug: "demo-hotel",
    hotelUserId: "hotel-user-1",
  });

  assert.throws(
    () =>
      resolveTelegramSettingsAccessFromContext(
        {
          kind: "hotel_user",
          authUserId: "auth-manager-1",
          email: "manager@example.com",
          hotelId: "hotel-1",
          hotelName: "Demo Hotel",
          hotelSlug: "demo-hotel",
          hotelUserId: "hotel-user-2",
          hotelRole: "manager",
        },
        {
          requestedHotelId: null,
          targetHotel: null,
        },
      ),
    (error) =>
      error instanceof AuthorizationError &&
      error.message === "Hotel admin access is required.",
  );

  const superAdminMissingHotel = resolveTelegramSettingsAccessFromContext(
    {
      kind: "super_admin",
      authUserId: "auth-super-1",
      email: "owner@example.com",
    },
    {
      requestedHotelId: null,
      targetHotel: null,
    },
  );
  assert.deepEqual(superAdminMissingHotel, {
    actorKind: "super_admin_missing_hotel",
    authUserId: "auth-super-1",
    email: "owner@example.com",
  });

  const superAdminAccess = resolveTelegramSettingsAccessFromContext(
    {
      kind: "super_admin",
      authUserId: "auth-super-1",
      email: "owner@example.com",
    },
    {
      requestedHotelId: "hotel-2",
      targetHotel: {
        id: "hotel-2",
        name: "Support Hotel",
        slug: "support-hotel",
      },
    },
  );
  assert.deepEqual(superAdminAccess, {
    actorKind: "super_admin",
    authUserId: "auth-super-1",
    hotelId: "hotel-2",
    hotelName: "Support Hotel",
    hotelSlug: "support-hotel",
    hotelUserId: null,
  });

  assert.throws(
    () =>
      resolveTelegramSettingsAccessFromContext(
        {
          kind: "super_admin",
          authUserId: "auth-super-1",
          email: "owner@example.com",
        },
        {
          requestedHotelId: "hotel-2",
          targetHotel: null,
        },
      ),
    (error) =>
      error instanceof AuthorizationError &&
      error.message === "Requested hotel is not available.",
  );
}

function testSummaryReadModelDoesNotExposeSecrets() {
  const summary = createTelegramIntegrationSummary({
    id: "integration-1",
    hotel_id: "hotel-1",
    name: "Telegram Bot",
    bot_username: "demo_bot",
    webhook_path_token: "opaque-token",
    is_active: true,
    last_verified_at: "2026-04-19T09:00:00.000Z",
    last_error_at: null,
    last_error_code: null,
    last_error_message: null,
    created_at: "2026-04-19T08:00:00.000Z",
    updated_at: "2026-04-19T09:00:00.000Z",
  });

  assert.deepEqual(Object.keys(summary).sort(), [
    "botUsername",
    "createdAt",
    "hotelId",
    "integrationId",
    "isActive",
    "lastErrorAt",
    "lastErrorCode",
    "lastErrorMessage",
    "lastVerifiedAt",
    "name",
    "updatedAt",
    "webhookPathToken",
  ]);
  assert.equal("botToken" in summary, false);
  assert.equal("botTokenEncrypted" in summary, false);
  assert.equal("webhookSecret" in summary, false);
}

try {
  testSecretHelpers();
  testTelegramSettingsAccessResolver();
  testSummaryReadModelDoesNotExposeSecrets();

  console.log("PH1-02 helper checks passed.");
} catch (error) {
  console.error("PH1-02 helper checks failed.");
  throw error;
} finally {
  process.env.TELEGRAM_TOKEN_ENCRYPTION_SECRET = previousSecret;
  process.env.APP_BASE_URL = previousAppBaseUrl;
}
