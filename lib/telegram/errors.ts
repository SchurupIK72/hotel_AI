export class TelegramIntegrationUnavailableError extends Error {
  constructor(message = "No active Telegram integration is configured for this hotel.") {
    super(message);
    this.name = "TelegramIntegrationUnavailableError";
  }
}

export type TelegramSendFailureKind = "rejected" | "ambiguous";

export class TelegramSendMessageError extends Error {
  kind: TelegramSendFailureKind;

  constructor(kind: TelegramSendFailureKind, message: string) {
    super(message);
    this.name = "TelegramSendMessageError";
    this.kind = kind;
  }
}
