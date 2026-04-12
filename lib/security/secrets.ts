import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getTelegramTokenEncryptionSecret } from "../env.ts";

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function deriveKey() {
  return createHash("sha256")
    .update(getTelegramTokenEncryptionSecret(), "utf8")
    .digest();
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSecret(payload: string) {
  const buffer = Buffer.from(payload, "base64url");
  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const encrypted = buffer.subarray(IV_BYTES + AUTH_TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
