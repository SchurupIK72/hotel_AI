import type { TelegramClientConfig } from "./integrations.ts";
import { TelegramSendMessageError } from "./errors.ts";

const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const TELEGRAM_TOKEN_PATTERN = /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g;

type TelegramGetMeResponse = {
  ok: boolean;
  result?: {
    id?: number;
    username?: string;
  };
  error_code?: number;
  description?: string;
};

type TelegramSendMessageResponse = {
  ok: boolean;
  result?: {
    message_id?: number;
  };
  error_code?: number;
  description?: string;
};

export type TelegramVerificationResult =
  | {
      ok: true;
      botUsername: string | null;
      telegramBotId: number | null;
    }
  | {
      ok: false;
      errorCode: string;
      errorMessage: string;
    };

function buildTelegramApiUrl(botToken: string, method: string) {
  return `${TELEGRAM_API_BASE_URL}/bot${botToken}/${method}`;
}

export function sanitizeTelegramErrorMessage(message: string | null | undefined) {
  const normalized = (message ?? "Telegram request failed.").replace(TELEGRAM_TOKEN_PATTERN, "[redacted]");
  return normalized.trim().slice(0, 300);
}

function createTelegramFailure(errorCode: string, errorMessage: string): TelegramVerificationResult {
  return {
    ok: false,
    errorCode,
    errorMessage: sanitizeTelegramErrorMessage(errorMessage),
  };
}

export async function verifyTelegramBotToken(botToken: string): Promise<TelegramVerificationResult> {
  try {
    const response = await fetch(buildTelegramApiUrl(botToken, "getMe"), {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as TelegramGetMeResponse;

    if (!response.ok || !payload.ok) {
      return createTelegramFailure(
        payload.error_code ? `telegram_${payload.error_code}` : "telegram_verification_failed",
        payload.description ?? "Telegram token verification failed.",
      );
    }

    return {
      ok: true,
      botUsername: payload.result?.username ?? null,
      telegramBotId: payload.result?.id ?? null,
    };
  } catch {
    return createTelegramFailure("telegram_request_failed", "Unable to verify Telegram bot token.");
  }
}

export async function sendTelegramTextMessage(
  config: TelegramClientConfig,
  input: { chatId: string | number; text: string },
) {
  let response: Response;

  try {
    response = await fetch(buildTelegramApiUrl(config.botToken, "sendMessage"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
      }),
    });
  } catch {
    throw new TelegramSendMessageError(
      "ambiguous",
      "Telegram delivery outcome could not be confirmed.",
    );
  }

  let payloadText = "";
  try {
    payloadText = await response.text();
  } catch {
    throw new TelegramSendMessageError(
      "ambiguous",
      "Telegram delivery outcome could not be confirmed.",
    );
  }

  let payload: TelegramSendMessageResponse | null = null;
  if (payloadText.trim()) {
    try {
      payload = JSON.parse(payloadText) as TelegramSendMessageResponse;
    } catch {
      throw new TelegramSendMessageError(
        "ambiguous",
        "Telegram delivery outcome could not be confirmed.",
      );
    }
  }

  if (!response.ok || !payload?.ok) {
    throw new TelegramSendMessageError(
      "rejected",
      sanitizeTelegramErrorMessage(payload?.description ?? "Telegram sendMessage request failed."),
    );
  }

  if (payload.result?.message_id == null) {
    throw new TelegramSendMessageError(
      "ambiguous",
      "Telegram delivery outcome could not be confirmed.",
    );
  }

  return {
    telegramMessageId: payload.result.message_id,
  };
}
