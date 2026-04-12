# Local Setup

This project uses a local Supabase stack for Auth and Postgres. A plain Postgres container is not enough, because the app depends on `auth.users` and Supabase Auth behavior.

The setup below follows Supabase local development conventions:

- local stack via `supabase start`
- reproducible seed data via `supabase/seed.sql`
- extra demo auth bootstrap via a service-role script

References:

- Supabase local development: https://supabase.com/docs/guides/local-development
- Supabase CLI config: https://supabase.com/docs/guides/cli/config
- Supabase seeding: https://supabase.com/docs/guides/local-development/seeding-your-database

## Prerequisites

- Node.js 22+
- npm
- Docker Desktop

The repo already includes the Supabase CLI as a dev dependency, so you do not need a global install.

## Files Added for Local Development

- `supabase/config.toml`
- `supabase/seed.sql`
- `scripts/bootstrap-local-demo.mjs`
- `docker-compose.yml`
- `.env.example`

## Step 1: Install dependencies

```powershell
npm.cmd install
```

## One-command setup

If you want the project to get almost all the way to "open localhost:3000 and sign in with the demo user", run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1
```

Or:

```powershell
npm.cmd run dev:setup
```

What it does:

- installs npm dependencies;
- starts the local Supabase stack;
- reads local anon and service-role keys from `supabase status -o env`;
- writes or updates `.env.local`;
- resets the local database and applies migrations/seeds;
- bootstraps the demo auth user and hotel membership;
- starts `npm run dev` in a new PowerShell window.

Useful flags:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1 -SkipInstall
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1 -SkipAppStart
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1 -ForceEnvRewrite
```

## One-command stop

To stop the local app window and Supabase stack together:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-stop.ps1
```

Or:

```powershell
npm.cmd run dev:stop
```

What it does:

- stops `next dev` / `npm run dev` PowerShell processes started for this repo;
- runs `supabase stop` for the local stack.

If you want to stop the app but keep Supabase running:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-stop.ps1 -KeepSupabaseRunning
```

## Step 2: Start the local Supabase stack

```powershell
npm.cmd run supabase:start
```

This starts the local Supabase containers in Docker.

## Step 3: Export local Supabase connection values

Get the current local keys and URLs:

```powershell
npm.cmd run supabase:status:env
```

This prints values like:

- `API_URL`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`

## Step 4: Create `.env.local`

Create `.env.local` in the repo root. Use `.env.example` as the base.

For local Supabase development, it should look like:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_ANON_KEY_FROM_SUPABASE_STATUS
SUPABASE_SERVICE_ROLE_KEY=PASTE_SERVICE_ROLE_KEY_FROM_SUPABASE_STATUS
APP_BASE_URL=http://localhost:3000
TELEGRAM_TOKEN_ENCRYPTION_SECRET=replace-with-a-local-dev-secret
SUPER_ADMIN_EMAILS=owner@example.com
DEMO_HOTEL_ID=11111111-1111-1111-1111-111111111111
DEMO_HOTEL_NAME=Demo Hotel
DEMO_HOTEL_SLUG=demo-hotel
DEMO_ADMIN_EMAIL=demo-admin@hotel.local
DEMO_ADMIN_PASSWORD=DemoPass123!
DEMO_ADMIN_FULL_NAME=Demo Hotel Admin
```

## Step 5: Reset the database and apply migrations

```powershell
npm.cmd run supabase:reset
```

This applies:

- all SQL migrations from `supabase/migrations`
- seed data from `supabase/seed.sql`

The seed file inserts the demo hotel row.

## Step 6: Bootstrap the demo auth user and hotel membership

```powershell
npm.cmd run demo:bootstrap
```

This script:

- creates the demo auth user through the Supabase Auth admin API if it does not already exist
- upserts the demo hotel
- creates or updates the `hotel_users` membership row

Demo credentials by default:

- email: `demo-admin@hotel.local`
- password: `DemoPass123!`

## Step 7: Run the app locally

### Option A: Run on your host machine

```powershell
npm.cmd run dev
```

Open:

- app: `http://localhost:3000`
- Supabase Studio: `http://127.0.0.1:54323`

### Option B: Run the app in Docker

This repo includes a simple `docker-compose.yml` for the Next.js app container only. The database/auth stack is still managed by Supabase CLI.

```powershell
docker compose up
```

In this mode:

- the app runs in Docker on port `3000`
- the app still talks to local Supabase via `.env.local`

## Step 8: Sign in

Open `http://localhost:3000/sign-in` and use:

- email: `demo-admin@hotel.local`
- password: `DemoPass123!`

You should land on the protected dashboard shell and see hotel-scoped access context information.

## Useful Commands

Start local Supabase:

```powershell
npm.cmd run supabase:start
```

Stop local Supabase:

```powershell
npm.cmd run supabase:stop
```

Reset DB and re-run migrations + seeds:

```powershell
npm.cmd run supabase:reset
```

Recreate demo auth user/membership:

```powershell
npm.cmd run demo:bootstrap
```

Run the PH1-02 helper sanity check:

```powershell
npm.cmd run test:ph1-02
```

## Important Notes

- `supabase/seed.sql` is used for reproducible database seed data.
- The demo auth user is created by `scripts/bootstrap-local-demo.mjs`, not directly by SQL, because that uses the supported Auth admin API instead of depending on internal `auth` table layout.
- `docker-compose.yml` is only for the app container. Supabase local infrastructure is started by the CLI.
- If you change `supabase/config.toml`, restart the stack:

```powershell
npm.cmd run supabase:stop
npm.cmd run supabase:start
```
