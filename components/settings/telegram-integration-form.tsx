import { saveTelegramIntegrationAction } from "@/app/dashboard/settings/telegram/actions";
import type { TelegramIntegrationSummary } from "@/lib/telegram/integrations";

type TelegramIntegrationFormProps = {
  activeIntegration: TelegramIntegrationSummary | null;
};

export function TelegramIntegrationForm({ activeIntegration }: TelegramIntegrationFormProps) {
  return (
    <form action={saveTelegramIntegrationAction} className="card form-stack">
      <div className="stack">
        <div>
          <p className="eyebrow">Hotel Admin Only</p>
          <h2 className="title section-title">
            {activeIntegration ? "Rotate or update Telegram bot" : "Connect Telegram bot"}
          </h2>
          <p className="body-copy">
            Saving the form verifies the bot token on the server with Telegram `getMe`.
            The raw token is never shown again after submit.
          </p>
        </div>

        <label className="label-stack">
          Integration name
          <input
            className="input"
            defaultValue={activeIntegration?.name ?? "Telegram Bot"}
            maxLength={80}
            name="name"
            placeholder="Telegram Bot"
            required
            type="text"
          />
        </label>

        <label className="label-stack">
          Bot token
          <input
            autoComplete="off"
            className="input"
            name="botToken"
            placeholder="123456:telegram-bot-token"
            required
            type="password"
          />
        </label>

        <label className="label-stack">
          Webhook secret
          <input
            autoComplete="off"
            className="input"
            name="webhookSecret"
            placeholder="Optional shared secret for webhook verification"
            type="password"
          />
        </label>
      </div>

      <button className="button" type="submit">
        {activeIntegration ? "Verify and save changes" : "Verify and connect bot"}
      </button>
    </form>
  );
}
