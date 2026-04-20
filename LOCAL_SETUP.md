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

Run the PH1-03 helper sanity check:

```powershell
npm.cmd run test:ph1-03
```

Run the PH1-03 live smoke verification against local Supabase:

```powershell
npm.cmd run verify:ph1-03
```

Run the PH1-06 live smoke verification against local Supabase:

```powershell
npm.cmd run verify:ph1-06
```

Run the PH1-07 live smoke verification against local Supabase:

```powershell
npm.cmd run verify:ph1-07
```

Run the PH1-08 live smoke verification against local Supabase:

```powershell
npm.cmd run verify:ph1-08
```

Run the PH1-09 live smoke verification against local Supabase:

```powershell
npm.cmd run verify:ph1-09
```

Run the PH1-10 release acceptance orchestrator against local Supabase:

```powershell
npm.cmd run verify:ph1-10
```

## PH1-04 Manual Workspace Smoke Check

Once PH1-03 ingestion has created at least one conversation, you can verify the conversation workspace manually:

1. Start the app with `npm.cmd run dev`
2. Sign in at `http://localhost:3000/sign-in`
3. Open `http://localhost:3000/dashboard/inbox`
4. Confirm the inbox list shows only hotel-scoped conversations ordered by latest activity
5. Confirm the default workspace opens the newest conversation automatically
6. Open another conversation from the list and verify:
   - guest summary fields render without exposing raw payloads
   - timeline messages are chronological
   - unread badge and last preview match the stored conversation state
   - the draft panel shows the PH1-04 placeholder state
7. Open a fake conversation URL such as `http://localhost:3000/dashboard/inbox/not-a-real-id` and confirm the app shows a safe not-found experience

## PH1-05 Manual Operations Smoke Check

Once the inbox contains at least one unread conversation, you can verify the PH1-05 operations flow manually:

1. Start the app with `npm.cmd run dev`
2. Sign in at `http://localhost:3000/sign-in`
3. Open `http://localhost:3000/dashboard/inbox?filter=unread`
4. Open one unread conversation from the list and confirm:
   - the conversation disappears from the `unread` filter after the explicit detail route opens
   - the workspace still shows the selected conversation safely
5. Change the status to `pending` and confirm the banner reports a saved operation
6. Assign the conversation to yourself and confirm it appears under `http://localhost:3000/dashboard/inbox?filter=assigned_to_me`
7. Unassign the conversation and confirm it disappears from `assigned_to_me`

## PH1-06 Manual Knowledge Smoke Check

Once you are signed in as the demo hotel admin, you can verify the PH1-06 knowledge flow manually:

1. Start the app with `npm.cmd run dev`
2. Sign in at `http://localhost:3000/sign-in`
3. Open `http://localhost:3000/dashboard/knowledge`
4. Create a new FAQ item and confirm it first appears with a `draft` badge
5. Edit the FAQ answer and save it, then confirm the success banner and updated metadata
6. Publish the FAQ item and confirm:
   - the badge changes to `published`
   - the `Published` timestamp is populated
   - the governance copy says the item is approved for later Copilot retrieval
7. Create a policy item, publish it, then move it back to draft and confirm:
   - the draft badge returns
   - the `Published` timestamp clears back to `Not published`
   - the item remains stored and editable
8. Delete the temporary FAQ and policy items when you finish the smoke check

## PH1-07 Manual Retrieval Smoke Check

Once PH1-06 knowledge items exist for the demo hotel, you can verify PH1-07 retrieval behavior manually:

1. Start the app with `npm.cmd run dev`
2. Sign in at `http://localhost:3000/sign-in`
3. Open `http://localhost:3000/dashboard/knowledge`
4. Create and publish one FAQ item for an informational topic such as breakfast hours
5. Create and publish one policy item for an operational rule such as late checkout
6. Create one additional draft-only knowledge item for a topic not covered anywhere else, such as airport shuttle
7. Run `npm.cmd run verify:ph1-07`
8. Confirm the smoke script passes and therefore proves:
   - published FAQ and policy knowledge is retrievable
   - policy evidence can outrank FAQ evidence when both are relevant
   - draft-only knowledge is ignored by retrieval
   - no-evidence queries return clarification or escalation mode instead of confident evidence
   - retrieval emits `kb_retrieval_requested` and `kb_retrieval_completed` with compact evidence summaries

## PH1-08 Manual Draft Smoke Check

Once PH1-08 is wired, you can verify real draft generation and regenerate behavior manually:

1. Start the app with `npm.cmd run dev`
2. Sign in at `http://localhost:3000/sign-in`
3. Run `npm.cmd run verify:ph1-08`
4. Open `http://localhost:3000/dashboard/inbox`
5. Find the three smoke conversations created by the script and confirm:
   - the supported informational conversation shows ready drafts with `knowledge-backed` confidence
   - the fallback informational conversation shows cautious drafts rather than invented operational facts
   - the unsupported refund or booking conversation keeps a safe empty draft panel state
6. Open the supported conversation and click `Refresh drafts`
7. Confirm the saved banner appears and the draft panel still shows a ready state with fresh metadata
8. Confirm the rest of the workspace remains usable:
   - guest summary still renders
   - timeline still renders
   - inbox filters and conversation selection still behave normally

## PH1-09 Manual Reply Smoke Check

Once PH1-08 drafts are working and the local demo hotel has an active Telegram integration, you can verify the approved reply flow manually:

1. Start the app with `npm.cmd run dev`
2. Sign in at `http://localhost:3000/sign-in`
3. Run `npm.cmd run verify:ph1-09`
4. Open `http://localhost:3000/dashboard/inbox`
5. Find the four PH1-09 smoke conversations and confirm:
   - the supported informational conversation has a selected draft and a delivered outbound message linked to that draft
   - the unsupported conversation allows a manual reply without pretending an AI draft existed
   - the retryable failure conversation does not present the failed send as delivered
   - the ambiguous failure conversation keeps the failure state visible for operator review
6. Open the supported conversation and confirm the composer can still switch between draft-backed and manual editing safely
7. Confirm the timeline and reply feedback stay tenant-scoped and do not expose raw Telegram tokens or provider secrets

## PH1-10 Release Acceptance Flow

Use this flow before merge to `main` or before a pilot handoff when you need Phase 1 evidence rather than an isolated demo.

1. Start the local stack with `npm.cmd run supabase:start`
2. Reset the database with `npm.cmd run supabase:reset` if your local schema or seed data may be stale
3. Recreate the demo auth user and hotel membership with `npm.cmd run demo:bootstrap`
4. Run the final release gate with `npm.cmd run verify:ph1-10`
5. Treat any `[fail]` line in the output as a release blocker until the named acceptance item is understood and resolved
6. Treat `[manual]` lines as residual operator checks that still require an explicit human sign-off

Release-ready evidence for PH1-10 means:

- `verify:ph1-10` ends with `Phase 1 release outcome: PASS`
- the output names each acceptance item and its proof artifact
- manual checks remain documented and consciously signed off rather than assumed complete
- the final handoff notes include the branch or commit under review and the date of the local verification run

If `demo:bootstrap` fails right after `supabase:reset`, wait for the local auth service to recover and rerun it. A clean `supabase:stop` then `supabase:start` cycle usually resolves this local-only startup issue.

## Important Notes

- `supabase/seed.sql` is used for reproducible database seed data.
- The demo auth user is created by `scripts/bootstrap-local-demo.mjs`, not directly by SQL, because that uses the supported Auth admin API instead of depending on internal `auth` table layout.
- `docker-compose.yml` is only for the app container. Supabase local infrastructure is started by the CLI.
- PH1-10 release handoff guidance lives in `.ai/specs/phase1/ph1-10-release-handoff-evidence.md`.
- If you change `supabase/config.toml`, restart the stack:

```powershell
npm.cmd run supabase:stop
npm.cmd run supabase:start
```
