import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../../lib/security/secrets.ts";
import { sanitizeTelegramErrorMessage } from "../../lib/telegram/api.ts";
import {
  buildTelegramWebhookUrl,
  createWebhookPathToken,
} from "../../lib/telegram/integrations.ts";

const previousSecret = process.env.TELEGRAM_TOKEN_ENCRYPTION_SECRET;
const previousAppBaseUrl = process.env.APP_BASE_URL;
process.env.TELEGRAM_TOKEN_ENCRYPTION_SECRET = "ph1-02-test-secret";
process.env.APP_BASE_URL = "https://hotel-ai.test";

try {
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

  console.log("PH1-02 helper checks passed.");
} catch (error) {
  console.error("PH1-02 helper checks failed.");
  throw error;
} finally {
  process.env.TELEGRAM_TOKEN_ENCRYPTION_SECRET = previousSecret;
  process.env.APP_BASE_URL = previousAppBaseUrl;
}
