import { deactivateTelegramIntegrationAction } from "@/app/dashboard/settings/telegram/actions";
import { TelegramIntegrationForm } from "@/components/settings/telegram-integration-form";
import { requireHotelAdmin } from "@/lib/auth/guards";
import { getTelegramWebhookEndpoint, listTelegramIntegrationsForHotel } from "@/lib/telegram/integrations";

type TelegramSettingsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function TelegramSettingsPage({ searchParams }: TelegramSettingsPageProps) {
  const access = await requireHotelAdmin();
  const integrations = await listTelegramIntegrationsForHotel(access.hotelId);
  const activeIntegration = integrations.find((integration) => integration.isActive) ?? null;
  const latestIntegration = integrations[0] ?? null;
  const webhookEndpoint = await getTelegramWebhookEndpoint(access.hotelId);
  const params = (await searchParams) ?? {};
  const flashMessage = params.message ?? null;

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">PH1-02</p>
        <h1 className="title">Telegram integration</h1>
        <p className="body-copy">
          Telegram runtime contracts and secret storage are now wired on the server.
          This page shows non-secret integration metadata for the active hotel.
        </p>
      </div>
      {params.status === "saved" && flashMessage ? (
        <p className="success-text">{flashMessage}</p>
      ) : null}
      {params.status === "error" && flashMessage ? (
        <p className="error-text">{flashMessage}</p>
      ) : null}
      {activeIntegration ? (
        <div className="meta-grid">
          <article className="meta-card">
            <h2>Name</h2>
            <p className="body-copy mono">{activeIntegration.name}</p>
          </article>
          <article className="meta-card">
            <h2>Bot username</h2>
            <p className="body-copy mono">{activeIntegration.botUsername ?? "Pending verification"}</p>
          </article>
          <article className="meta-card">
            <h2>Webhook token</h2>
            <p className="body-copy mono">{activeIntegration.webhookPathToken}</p>
          </article>
          <article className="meta-card">
            <h2>Status</h2>
            <p className="body-copy mono">{activeIntegration.isActive ? "active" : "inactive"}</p>
          </article>
          <article className="meta-card">
            <h2>Last verified</h2>
            <p className="body-copy mono">{activeIntegration.lastVerifiedAt ?? "Not verified yet"}</p>
          </article>
          {webhookEndpoint ? (
            <article className="meta-card">
              <h2>Webhook URL</h2>
              <p className="body-copy mono">{webhookEndpoint.webhookUrl}</p>
            </article>
          ) : null}
        </div>
      ) : (
        <article className="meta-card">
          <h2>No Telegram integration configured</h2>
          <p className="body-copy">
            The hotel does not have an active Telegram bot yet. Use the form below to save
            a bot token and verify it before later inbound and outbound messaging work starts.
          </p>
        </article>
      )}
      {latestIntegration?.lastErrorMessage ? (
        <article className="meta-card">
          <h2>Latest verification error</h2>
          <p className="body-copy">{latestIntegration.lastErrorMessage}</p>
        </article>
      ) : null}
      {webhookEndpoint ? (
        <article className="meta-card">
          <h2>Manual Telegram webhook setup</h2>
          <div className="stack">
            <p className="body-copy">
              Use this URL when you call Telegram `setWebhook` for the bot. The endpoint is already
              reserved and validates the optional secret token, while full inbound ingestion lands in PH1-03.
            </p>
            <p className="body-copy mono">{webhookEndpoint.webhookUrl}</p>
            <p className="body-copy">
              If you saved a webhook secret, pass it as Telegram `secret_token`. After webhook setup,
              keep the integration active until PH1-03 is implemented so the endpoint stays stable.
            </p>
          </div>
        </article>
      ) : null}
      {activeIntegration ? (
        <form action={deactivateTelegramIntegrationAction}>
          <button className="button secondary-button" type="submit">
            Deactivate integration
          </button>
        </form>
      ) : null}
      <TelegramIntegrationForm activeIntegration={activeIntegration} />
    </section>
  );
}
