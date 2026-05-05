# Deploy

## Purpose

This document explains how to deploy the current Phase 1 version of the project:

- application server;
- database and auth via Supabase;
- Telegram bot and webhook delivery.

It is written for the codebase in its current state on `main`.

## What Gets Deployed

The running system has three main parts:

1. Next.js application
   The dashboard, sign-in flow, server actions, and Telegram webhook endpoint live here.
2. Supabase project
   Postgres, Auth, and the tables used by hotels, staff users, conversations, messages, drafts, and event logs live here.
3. Telegram bot
   Telegram delivers guest messages to the app via a webhook. The app stores inbound messages and lets hotel staff send approved replies.

## Recommended Production Topology

For the current project stage, the simplest reliable setup is:

- one public HTTPS domain for the app, for example `https://hotel-ai.example.com`;
- one Supabase Cloud project for database and auth;
- one Linux server or container runtime for the Next.js app;
- one Telegram bot per hotel integration, configured through the app UI.

Recommended stack:

- Ubuntu 22.04 or 24.04 on the app server;
- Node.js 22;
- Nginx as reverse proxy;
- systemd or another process manager for the Next.js process;
- Supabase Cloud for Postgres/Auth.

## Before You Start

Prepare these items first:

- a public domain with HTTPS;
- a server that can run Node.js 22;
- a Supabase project;
- a Telegram bot token from `@BotFather`;
- one initial staff email that will become the first hotel admin.

## Environment Variables

The app requires these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_BASE_URL=https://hotel-ai.example.com
TELEGRAM_TOKEN_ENCRYPTION_SECRET=replace-with-a-long-random-secret
SUPER_ADMIN_EMAILS=owner@example.com
```

Notes:

- `APP_BASE_URL` must be the real public HTTPS URL of the deployed app.
- `TELEGRAM_TOKEN_ENCRYPTION_SECRET` should be a long random secret and must stay stable after first deployment.
- `SUPER_ADMIN_EMAILS` is optional, but useful for internal support access across hotels.
- Do not reuse the demo local credentials from `.env.example` in production.

## Step 1. Create the Supabase Project

Create a new Supabase Cloud project.

Then copy these values from the project settings:

- Project URL
- anon key
- service role key

You will use them in the app server environment.

Official references:

- Supabase CLI and project workflow: https://supabase.com/docs/guides/cli/getting-started
- Supabase `db push`: https://supabase.com/docs/reference/cli/supabase-link

## Step 2. Apply Database Migrations

This repository stores schema changes in `supabase/migrations`.

Recommended deployment flow:

1. Install dependencies locally or in CI.
2. Link the repository to the target Supabase project.
3. Push local migrations to the remote database.

Example:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Important:

- run migrations before starting the new app version;
- do not skip migrations from earlier phases;
- if you deploy through CI, make `db push` part of the release pipeline.

## Step 3. Create the First Hotel and Staff User

The app authorizes hotel staff through Supabase Auth plus `public.hotel_users`.

That means a user must exist in both places:

1. in Supabase Auth;
2. in `public.hotel_users` with an active hotel membership.

### 3.1 Create the Auth user

In the Supabase dashboard:

1. Open `Authentication -> Users`.
2. Create a user with email and password.
3. Copy the created auth user UUID.

### 3.2 Insert the hotel and membership

Run SQL in Supabase SQL Editor.

Example:

```sql
insert into public.hotels (
  id,
  name,
  slug,
  default_language,
  timezone
)
values (
  gen_random_uuid(),
  'Demo Hotel',
  'demo-hotel',
  'en',
  'Europe/Moscow'
)
returning id;
```

Copy the returned hotel UUID, then create the staff membership:

```sql
insert into public.hotel_users (
  hotel_id,
  auth_user_id,
  role,
  full_name,
  is_active
)
values (
  '<hotel-uuid>',
  '<auth-user-uuid>',
  'hotel_admin',
  'Demo Hotel Admin',
  true
);
```

You now have the first hotel admin who can sign in and configure Telegram.

## Step 4. Prepare the Application Server

Example for Ubuntu:

```bash
sudo apt update
sudo apt install -y nginx curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Clone the repository and install dependencies:

```bash
git clone <your-repo-url> /opt/hotelAI
cd /opt/hotelAI
npm ci
```

Create a production env file, for example `/opt/hotelAI/.env.production`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_BASE_URL=https://hotel-ai.example.com
TELEGRAM_TOKEN_ENCRYPTION_SECRET=replace-with-a-long-random-secret
SUPER_ADMIN_EMAILS=owner@example.com
```

Build the app:

```bash
cd /opt/hotelAI
export $(grep -v '^#' .env.production | xargs)
npm run build
```

## Step 5. Run the App as a Service

Example `systemd` unit:

```ini
[Unit]
Description=Hotel AI Next.js App
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/hotelAI
EnvironmentFile=/opt/hotelAI/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Save it as `/etc/systemd/system/hotel-ai.service`, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable hotel-ai
sudo systemctl start hotel-ai
sudo systemctl status hotel-ai
```

By default, `next start` listens on port `3000`.

## Step 6. Put Nginx in Front

Example Nginx config:

```nginx
server {
    listen 80;
    server_name hotel-ai.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then enable HTTPS with your normal TLS flow, for example Let's Encrypt.

Telegram webhook delivery should use the final HTTPS domain, not an internal IP.

## Step 7. Sign In and Configure Telegram in the App

After the app is live:

1. Open `https://hotel-ai.example.com/sign-in`.
2. Sign in as the `hotel_admin` you created.
3. Open `https://hotel-ai.example.com/dashboard/settings/telegram`.
4. Fill in:
   - Integration name
   - Bot token
   - Optional webhook secret
5. Submit the form.

The app will:

- verify the bot token server-side using Telegram `getMe`;
- store the encrypted token in the database;
- generate a webhook path token;
- show you the final webhook URL to register in Telegram.

Important:

- managers are not allowed to manage Telegram settings;
- raw bot tokens are not shown again after save.

## Step 8. Register the Telegram Webhook

After saving the integration, copy the webhook URL shown on the Telegram settings page.

If you also saved a webhook secret, use it as Telegram `secret_token`.

Official Telegram reference:

- Telegram Bot API `setWebhook`: https://core.telegram.org/bots/api

Example without secret:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hotel-ai.example.com/api/webhooks/telegram/<webhookPathToken>",
    "drop_pending_updates": true
  }'
```

Example with secret:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hotel-ai.example.com/api/webhooks/telegram/<webhookPathToken>",
    "secret_token": "YOUR_WEBHOOK_SECRET",
    "drop_pending_updates": true
  }'
```

Useful verification:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Telegram notes:

- the webhook URL must be HTTPS;
- standard Bot API webhook ports are `443`, `80`, `88`, or `8443`;
- if you use `secret_token`, Telegram sends it in the `X-Telegram-Bot-Api-Secret-Token` header.

## Step 9. Smoke-Test the Deployment

Minimum checks after deploy:

1. Sign in successfully.
2. Open `/dashboard`.
3. Open `/dashboard/settings/telegram` and confirm the integration is active.
4. Send a Telegram text message to the bot.
5. Open `/dashboard/inbox` and confirm the conversation appears.
6. If you are using the full Phase 1 release checklist, run the verification flow in a controlled environment before production rollout.

For local/full validation, see:

- [LOCAL_SETUP.md](./LOCAL_SETUP.md)
- [.ai/specs/phase1/ph1-10-release-handoff-evidence.md](./.ai/specs/phase1/ph1-10-release-handoff-evidence.md)

## Production Checklist

Before calling the deployment done, confirm:

- migrations were applied to the target database;
- the app server has all required environment variables;
- `APP_BASE_URL` is the real public HTTPS domain;
- at least one `hotel_admin` exists in `public.hotel_users`;
- the Telegram integration is saved and verified in the UI;
- `setWebhook` points to the URL shown by the app;
- inbound Telegram messages appear in the inbox;
- hotel staff can sign in and see only their own hotel data.

## Operational Notes

- The local helper script `demo:bootstrap` is for local development, not for production onboarding.
- Phase 1 currently supports supported inbound text messages and safe human-approved replies. Advanced media and broader Telegram update types are ignored safely.
- The app uses Supabase Auth cookies in the browser, so the public site and the Supabase project must both be reachable from the user’s browser.
- If you rotate `TELEGRAM_TOKEN_ENCRYPTION_SECRET` without a migration plan, previously stored bot tokens may become unreadable.

## Rollback Strategy

If a deployment fails:

1. restore the previous app version on the server;
2. keep the database schema only if the old app version is compatible with it;
3. if compatibility is unclear, stop and validate in staging before serving traffic again;
4. do not rotate or delete the Telegram bot unless you also update the webhook and integration settings intentionally.
