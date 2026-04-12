# PH1-02 - Hotel Setup and Telegram Integration

> **Created:** 2026-04-12
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** In Progress
> **Depends on:** PH1-01 - Tenant Foundation and Staff Access

---

## Summary

This feature enables one hotel to connect and operate one Telegram bot safely in Phase 1.

It defines how Telegram integration settings are stored, how credentials are protected, how the system resolves the active bot for a hotel, and how later features can reliably use a shared outbound Telegram client and integration lookup contract.

Without this feature, inbound ingestion and human-approved outbound replies cannot be implemented safely.

---

## Product Intent

Telegram is the only live guest communication channel in Phase 1.

This feature exists to make Telegram integration explicit, secure, and reusable for the rest of the phase.

### Must-have outcomes

- a hotel admin can configure one Telegram bot integration for the pilot hotel;
- the system stores Telegram integration settings in a tenant-safe model;
- bot token material is never exposed to the client;
- the backend can resolve one active Telegram integration for the hotel;
- later messaging features can use one shared Telegram service contract.

### Out of scope

- multiple active Telegram bots per hotel;
- guest-facing onboarding;
- non-Telegram channels;
- callback buttons, inline mode, payments, or other advanced Telegram bot features;
- rich message formatting beyond plain text;
- automatic webhook registration in Telegram if environment constraints make that impractical.

---

## Product Rules

### Pilot channel rule

For Phase 1, a hotel may have at most one active Telegram integration used for live messaging.

### Ownership rule

Only a `hotel_admin` or internal `super_admin` may create, update, deactivate, or inspect Telegram integration settings.

### Secret-handling rule

The Telegram bot token is a server secret.

It must:

- never be returned to browser clients;
- never be embedded in client bundles;
- never be written to logs in plaintext;
- only be used in trusted server-side code.

### Runtime rule

Inbound webhook handling and outbound send operations must resolve Telegram integration from trusted backend state, not from client input.

---

## Data Model Requirements

### Required table

`channel_integrations`

- `id uuid pk`
- `hotel_id uuid not null references hotels(id)`
- `channel text not null check (channel in ('telegram'))`
- `name text not null`
- `bot_token_encrypted text not null`
- `bot_username text null`
- `webhook_secret text null`
- `webhook_path_token text not null`
- `is_active boolean not null default true`
- `last_verified_at timestamptz null`
- `last_error_at timestamptz null`
- `last_error_code text null`
- `last_error_message text null`
- `created_by_hotel_user_id uuid null references hotel_users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Constraints

- exactly one active Telegram integration per hotel in Phase 1;
- `webhook_path_token` must be unique;
- inactive historical rows may remain for audit;
- token ciphertext must be replaceable without recreating the hotel.

### Required indexes

- `channel_integrations(hotel_id, channel, is_active)`
- `channel_integrations(webhook_path_token)`
- partial unique index enforcing one active Telegram integration per hotel and channel

### Required secret fields

`bot_token_encrypted`

- stores encrypted or sealed token material only;
- plaintext token must not be persisted in normal app tables or logs.

`webhook_path_token`

- stable opaque identifier used in webhook routing;
- must be random and not derivable from hotel slug or bot token.

---

## Security and Secret Management

### Server-only secret usage

Telegram credentials may be decrypted or resolved only in server runtime code used for:

- connection verification;
- webhook handling;
- outbound message sending.

### Logging restrictions

Allowed logs:

- integration id;
- hotel id;
- channel;
- bot username;
- verification timestamps;
- sanitized Telegram error metadata.

Forbidden logs:

- raw bot token;
- full Telegram request headers containing secrets;
- decrypted secret material.

### Access restrictions

- hotel admins can view integration status and non-secret metadata;
- hotel admins cannot retrieve the stored raw bot token after save;
- managers do not manage integration settings in Phase 1.

---

## Runtime Contracts

### Integration resolution contract

The backend must expose one shared server-side contract for resolving the active Telegram integration.

```ts
type ActiveTelegramIntegration = {
  integrationId: string;
  hotelId: string;
  channel: "telegram";
  botUsername: string | null;
  webhookPathToken: string;
  isActive: true;
};
```

### Secret resolution contract

Server code that needs to talk to Telegram must be able to retrieve a runtime client configuration like:

```ts
type TelegramClientConfig = {
  integrationId: string;
  hotelId: string;
  botToken: string;
  botUsername: string | null;
};
```

This contract must never cross a client boundary.

### Failure behavior

- no active Telegram integration for hotel -> feature-specific `409` or `422` where applicable;
- inactive integration used at runtime -> operation fails safely and logs structured error;
- malformed or revoked token -> verification failure is stored and surfaced through admin status.

---

## Application Interfaces

### Required admin capabilities

Phase 1 should support one of the following implementation styles:

- dedicated Telegram settings page;
- hotel settings section in dashboard;
- server actions backed by protected admin UI.

### Required admin actions

- create Telegram integration;
- rotate token by replacing stored token;
- deactivate integration;
- view integration status metadata;
- optionally trigger a verification check.

### Required read model for admin UI

The admin UI can show:

- integration name;
- channel type;
- bot username if resolved;
- active/inactive status;
- last verified timestamp;
- last known error summary.

The admin UI must not show:

- full bot token;
- raw encrypted token payload.

---

## Telegram API Contracts

### Minimum Telegram operations in Phase 1

- `getMe` for token verification;
- `sendMessage` for outbound text messages;
- webhook update intake through a project webhook endpoint.

### Verification contract

When a hotel admin saves or verifies a Telegram integration, the backend should:

1. use the provided token server-side;
2. call `getMe`;
3. validate that the token belongs to a bot account;
4. persist bot username and verification metadata on success;
5. persist sanitized error metadata on failure.

### Webhook contract

The system must support a stable webhook URL pattern for Telegram, for example:

`POST /api/webhooks/telegram/[integrationId]`

or an equivalent opaque integration token route if that is safer for operations.

Phase 1 may postpone automatic Telegram webhook registration as long as the required webhook target is clearly derivable and documented for setup.

---

## UI Behavior

### Hotel admin setup flow

1. Hotel admin opens Telegram integration settings.
2. Hotel admin enters integration display name and bot token.
3. Backend validates permissions and stores encrypted token material.
4. Backend attempts verification with Telegram.
5. UI shows success or sanitized failure state.
6. UI shows the webhook endpoint or setup status needed for activation.

### Manager visibility

Managers do not configure Telegram integration, but downstream messaging features may depend on integration status to show operational errors when the channel is unavailable.

### Error states

The UI should support:

- invalid token;
- verification failed;
- no active integration configured;
- integration deactivated;
- unexpected Telegram API failure.

---

## Implementation Plan

### Stage 1 - Telegram integration schema and constraints

**Goal**

Create a durable data model for storing one active Telegram integration per hotel.

**Tasks**

- add `channel_integrations` migration;
- define unique and active-state constraints;
- add encrypted token field and webhook path token field;
- add verification and error metadata columns;
- add indexes for active integration lookup.

**Expected file areas**

- `supabase/migrations/*`
- `lib/db/*.ts`
- `lib/tenants/*.ts`

**Acceptance**

- the schema can represent one active Telegram integration per hotel;
- duplicate active Telegram integrations for the same hotel are blocked.

### Stage 2 - Secret storage and verification service

**Goal**

Create reusable server-side logic for storing, rotating, and verifying Telegram credentials.

**Tasks**

- implement token encryption or sealed-storage strategy;
- implement Telegram `getMe` verification flow;
- persist sanitized verification status;
- implement server-only secret resolution helper for runtime use;
- ensure plaintext token never reaches client-facing responses.

**Expected file areas**

- `lib/telegram/*.ts`
- `lib/integrations/*.ts`
- `lib/security/*.ts`
- `app/api/*` or server actions for admin operations

**Acceptance**

- a valid token can be verified and stored;
- invalid tokens fail safely with sanitized error state;
- raw token is not exposed in responses or logs.

### Stage 3 - Admin setup surface

**Goal**

Give hotel admins a protected UI or equivalent action surface to manage Telegram integration.

**Tasks**

- add protected Telegram settings UI or settings section;
- restrict access to hotel admins;
- show non-secret integration metadata;
- support create, rotate, and deactivate flows;
- show verification result state.

**Expected file areas**

- `app/dashboard/settings/*` or equivalent
- `components/*`
- `lib/auth/*.ts`
- `lib/integrations/*.ts`

**Acceptance**

- a hotel admin can configure and maintain the Telegram integration without accessing secrets after save;
- a manager cannot use this settings flow.

### Stage 4 - Shared runtime integration contract

**Goal**

Provide one trusted resolution path used by inbound and outbound Telegram features.

**Tasks**

- implement `getActiveTelegramIntegration(hotelId)` helper;
- implement `getTelegramClientConfig(integrationId | hotelId)` helper;
- define failure and error logging rules;
- document the shared runtime contract for later features.

**Expected file areas**

- `lib/telegram/*.ts`
- `lib/integrations/*.ts`
- `lib/events/*.ts`
- `tests/*`

**Acceptance**

- later features can resolve active Telegram integration through one shared backend path;
- inactive or broken integrations fail with structured operational errors.

---

## Acceptance Criteria

This feature is complete only if:

1. a hotel admin can create one Telegram integration for the hotel;
2. the system stores Telegram credentials in protected server-side form;
3. plaintext bot token is never exposed in the browser or logs;
4. the system can verify a Telegram bot token through Telegram API;
5. the active Telegram integration can be resolved by trusted backend code;
6. duplicate active Telegram integrations for one hotel are prevented;
7. the integration can be deactivated without deleting historical metadata;
8. later inbound and outbound messaging features can consume one shared Telegram integration contract.

---

## Test Plan

### Unit tests

- active integration lookup for hotel with one active row;
- failure when no active integration exists;
- enforcement of one active integration per hotel;
- token verification result mapping for success and failure;
- sanitized error formatting does not leak secrets.

### Integration tests

- hotel admin can create or rotate integration through protected backend path;
- manager cannot mutate integration settings;
- stored integration can be resolved for server-side runtime use;
- inactive integration is excluded from active resolution;
- invalid token verification stores failure metadata without persisting plaintext token in outputs.

### Security checks

- verify no client-facing response contains raw bot token;
- verify logs contain only sanitized Telegram errors;
- verify integration access is restricted to the correct hotel.

## Implementation Progress

- [x] `channel_integrations` schema, indexes, uniqueness constraints, and RLS added
- [x] server-only service-role Supabase client added for protected integration operations
- [x] token encryption/decryption helper added for Telegram bot secret storage
- [x] shared runtime contracts implemented via `getActiveTelegramIntegration(...)` and `getTelegramClientConfig(...)`
- [x] Telegram API helper added for `getMe`/`sendMessage` with sanitized error handling
- [x] protected admin-only Telegram settings status page added at `/dashboard/settings/telegram`
- [x] hotel-admin write flow added for create and rotate with server-side verify via Telegram `getMe`
- [x] verification success and sanitized failure state now persist through the Telegram integration save flow
- [x] admin form UI added for saving bot token without exposing the stored secret afterward
- [x] deactivate action for hotel admins
- [x] stable webhook URL output and manual setup instructions added to the Telegram settings page
- [x] reserved webhook route contract added at `/api/webhooks/telegram/[webhookPathToken]`
- [ ] richer inactive-history review and operational webhook diagnostics

## Verification Commands

Run these checks locally after migrations are applied:

```bash
npm run typecheck
npm run test:ph1-02
npm run supabase:reset
```

---

## Dependencies for Next Features

This feature must be finished before:

- PH1-03 Inbound messaging ingestion
- PH1-09 Human-approved outbound reply flow

Those features may assume that Telegram integration lookup and Telegram client configuration already exist.

---

## Open Assumptions Locked for This Spec

- Phase 1 supports exactly one active Telegram bot integration per hotel.
- Telegram is the only live guest messaging channel in this phase.
- Token verification uses `getMe`.
- Automatic webhook registration may be deferred if manual operational setup is simpler for the pilot, but webhook target derivation must be stable and documented.
