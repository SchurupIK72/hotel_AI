import { deactivateTelegramIntegrationAction } from "@/app/dashboard/settings/telegram/actions";
import { TelegramIntegrationForm } from "@/components/settings/telegram-integration-form";
import { requireTelegramSettingsAccess } from "@/lib/auth/guards";
import { getTelegramWebhookEndpoint, listTelegramIntegrationsForHotel } from "@/lib/telegram/integrations";

type TelegramSettingsPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
    status?: string;
    message?: string;
  }>;
};

export default async function TelegramSettingsPage({ searchParams }: TelegramSettingsPageProps) {
  const params = (await searchParams) ?? {};
  const access = await requireTelegramSettingsAccess(params.hotelId ?? null);
  const flashMessage = params.message ?? null;

  if (access.actorKind === "super_admin_missing_hotel") {
    return (
      <section className="stack">
        <div>
          <p className="eyebrow">PH1-02</p>
          <h1 className="title">Telegram integration support</h1>
          <p className="body-copy">
            Internal support access requires an explicit hotel scope. Open this page with
            <span className="mono"> ?hotelId=&lt;uuid&gt;</span> to inspect or repair one hotel's Telegram setup.
          </p>
        </div>
        {params.status === "error" && flashMessage ? <p className="error-text">{flashMessage}</p> : null}
      </section>
    );
  }

  const integrations = await listTelegramIntegrationsForHotel(access.hotelId);
  const activeIntegration = integrations.find((integration) => integration.isActive) ?? null;
  const latestIntegration = integrations[0] ?? null;
  const webhookEndpoint = await getTelegramWebhookEndpoint(access.hotelId);

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
      {access.actorKind === "super_admin" ? (
        <article className="meta-card">
          <h2>Internal support mode</h2>
          <p className="body-copy">
            You are managing Telegram settings for <span className="mono">{access.hotelName ?? access.hotelId}</span>
            {" "}as an internal super admin.
          </p>
        </article>
      ) : null}
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
            <p className="body-copy mono mono-wrap">{activeIntegration.webhookPathToken}</p>
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
              <h2>Endpoint status</h2>
              <p className="body-copy mono">{webhookEndpoint.endpointStatus}</p>
            </article>
          ) : null}
          {webhookEndpoint ? (
            <article className="meta-card">
              <h2>Webhook URL</h2>
              <p className="body-copy mono mono-wrap">{webhookEndpoint.webhookUrl}</p>
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
              This endpoint is currently marked as <span className="mono">live_inbound_ingestion</span>.
              After Telegram webhook registration, supported inbound text messages should now enter the Phase 1 inbox pipeline.
            </p>
            <p className="body-copy mono mono-wrap">{webhookEndpoint.webhookUrl}</p>
            <p className="body-copy">
              If you save a webhook secret, pass it as Telegram `secret_token`. Phase 1 currently ingests
              supported text messages only; media and advanced Telegram update types are still ignored safely.
            </p>
          </div>
        </article>
      ) : null}
      {activeIntegration ? (
        <form action={deactivateTelegramIntegrationAction}>
          <input name="hotelId" type="hidden" value={access.actorKind === "super_admin" ? access.hotelId : ""} />
          <button className="button secondary-button" type="submit">
            Deactivate integration
          </button>
        </form>
      ) : null}
      <TelegramIntegrationForm
        activeIntegration={activeIntegration}
        hotelId={access.actorKind === "super_admin" ? access.hotelId : null}
        supportMode={access.actorKind === "super_admin"}
      />
    </section>
  );
}
