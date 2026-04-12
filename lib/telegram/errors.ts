export class TelegramIntegrationUnavailableError extends Error {
  constructor(message = "No active Telegram integration is configured for this hotel.") {
    super(message);
    this.name = "TelegramIntegrationUnavailableError";
  }
}
