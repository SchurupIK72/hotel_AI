# PH1-02 Completion Hardening - Safety, Super Admin Access, and Verification

> **Created:** 2026-04-13
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** Completed
> **Depends on:** PH1-02 - Hotel Setup and Telegram Integration

---

## Summary

This specification closed the remaining gaps that blocked PH1-02 from being marked complete at the time it was created.

The existing implementation already covers:

- `channel_integrations` schema and RLS;
- encrypted token storage;
- Telegram `getMe` verification;
- hotel-admin create/rotate/deactivate flow;
- runtime integration lookup contracts;
- manual webhook URL derivation.

Those remaining risks were:

1. the UI must not encourage live Telegram webhook activation before PH1-03 can safely consume inbound updates;
2. internal `super_admin` must be able to inspect and operate Telegram integration settings, per the feature rules;
3. the feature must have integration/security checks beyond helper-only smoke tests.

This follow-up spec existed to close those gaps cleanly without changing PH1-02 scope.

---

## Problem Statement

### Gap 1 - Premature live webhook activation

The current Telegram settings page shows a manual `setWebhook` instruction and a stable webhook URL, while the reserved webhook route only acknowledges requests and does not persist inbound messages yet.

This creates an operational risk:

- a hotel admin can connect a real bot too early;
- Telegram will start delivering live guest updates;
- the system will accept those calls but will not process them into Phase 1 inbox data;
- guest messages may be silently lost before PH1-03 is implemented.

### Gap 2 - Missing `super_admin` ownership path

The PH1-02 rules explicitly allow both `hotel_admin` and internal `super_admin` to inspect and manage Telegram integration settings.

The current implementation is hotel-admin-only.

This creates a mismatch between:

- the feature contract;
- operational support expectations;
- actual server-side guard behavior.

### Gap 3 - Incomplete verification layer

Current verification is limited to:

- `typecheck`;
- helper-level local checks;
- manual smoke validation.

This is not enough to mark the feature complete because the spec requires:

- permission enforcement checks;
- inactive integration behavior checks;
- secret non-leakage checks;
- runtime resolution checks for downstream features.

---

## Goals

This hardening spec must deliver:

- safe operational behavior before PH1-03 inbound ingestion exists;
- full ownership parity for `hotel_admin` and `super_admin`;
- minimum integration/security verification sufficient to close PH1-02 acceptance.

---

## Out of Scope

- PH1-03 inbound guest message ingestion;
- webhook deduplication or Telegram update persistence;
- automated webhook registration via Telegram `setWebhook`;
- multi-channel integration management;
- advanced diagnostics dashboards.

---

## Stakeholders

- `hotel_admin`
  Needs to configure and maintain the hotel Telegram bot safely.

- `super_admin`
  Needs to inspect, configure, repair, or deactivate integrations during pilot support.

- engineering / ops
  Need confidence that enabling Telegram integration will not create silent message-loss scenarios before PH1-03.

- future PH1-03 / PH1-09 implementation
  Depend on trustworthy runtime integration contracts and predictable failure behavior.

---

## Requirements

### R1 - Safe webhook readiness state

The system must prevent operators from interpreting PH1-02 webhook setup as production-ready inbound messaging before PH1-03 is available.

At least one of these behaviors must be implemented:

- the UI clearly labels webhook setup as `not live until PH1-03`;
- the route and UI expose a `reserved endpoint only` status;
- or webhook instructions are hidden behind an explicit non-production warning gate.

#### Acceptance

- the Telegram settings page does not imply that inbound guest messages are already handled end-to-end;
- an operator reading the page can understand that the endpoint is reserved but not yet connected to inbox ingestion;
- no success message suggests that the bot is fully live for guest messaging before PH1-03.

### R2 - Safe webhook route behavior

The reserved webhook route must behave safely until PH1-03.

It must:

- validate route token and optional webhook secret;
- reject unknown or inactive integrations;
- return a response that makes the route contract explicit;
- avoid implying that guest messages are fully processed.

It must not:

- pretend that inbound updates were persisted;
- return ambiguous success text that could be mistaken for completed ingestion.

#### Acceptance

- valid calls receive a response describing the route as reserved/pre-ingestion;
- invalid secret/token paths fail predictably;
- inactive integrations do not accept webhook traffic as active.

### R3 - `super_admin` access parity

Internal `super_admin` must be able to:

- open Telegram settings;
- inspect current non-secret integration metadata;
- save or rotate integration settings;
- deactivate active integration.

This access must be implemented without weakening tenant safety.

#### Constraints

- `super_admin` may operate through a hotel-scoped view or route parameter;
- client UI must still preserve the current hotel context explicitly;
- manager-level users must remain blocked.

#### Acceptance

- `hotel_admin` can still manage only their own hotel integration;
- `super_admin` can access Telegram integration management through a supported server path;
- `manager` cannot create, rotate, or deactivate integration settings.

### R4 - Permission model must remain explicit

After hardening, the feature must have one explicit rule:

- `hotel_admin` = same-hotel operational owner;
- `super_admin` = internal override/support owner;
- `manager` = read-no-write or no-access according to the chosen UI behavior, but never settings mutation.

#### Acceptance

- server actions enforce the rule centrally;
- the UI does not rely on client-only checks for authorization.

### R5 - Minimum integration verification suite

The feature must include a minimal but real verification layer beyond helper-only checks.

It must cover:

- hotel-admin create/rotate happy path;
- manager mutation denial;
- `super_admin` management path;
- inactive integration exclusion from active runtime resolution;
- sanitized failure handling for invalid token verification;
- no plaintext token exposure in UI/read models.

#### Acceptance

- the project contains runnable checks for the required scenarios;
- failures are attributable to a specific permission or integration-state rule;
- verification artifacts are documented in the spec and local setup docs if needed.

### R6 - Runtime contract stability

Hardening work must preserve the current runtime contracts already consumed by later features:

- `getActiveTelegramIntegration(hotelId)`
- `getTelegramClientConfig(integrationId | hotelId)`

No hardening change may break these contracts.

#### Acceptance

- later PH1-03 / PH1-09 work can keep using the same trusted server-side lookup path;
- hardening only adds safety and verification, not incompatible contract changes.

---

## Proposed Implementation Stages

### Stage 1 - Webhook safety messaging and reserved-route hardening

**Goal**

Make webhook setup operationally safe before inbound ingestion exists.

**Tasks**

- revise Telegram settings copy to clearly mark webhook flow as pre-ingestion;
- adjust reserved webhook route response text if needed;
- ensure active integration metadata distinguishes `configured` from `inbound-ready`;
- optionally add a small warning card or badge in the admin UI.

**Expected file areas**

- `app/dashboard/settings/telegram/page.tsx`
- `app/api/webhooks/telegram/[webhookPathToken]/route.ts`
- `components/settings/*`

**Acceptance**

- the page no longer implies that guest messages are already processed end-to-end;
- the reserved route contract is explicit and non-misleading.

### Stage 2 - `super_admin` support path

**Goal**

Bring actual access behavior in line with the PH1-02 ownership rule.

**Tasks**

- define how `super_admin` selects hotel context for Telegram settings;
- extend settings page and server actions to permit internal super-admin operations;
- keep hotel-admin behavior unchanged for same-hotel management;
- explicitly reject manager mutation attempts.

**Expected file areas**

- `lib/auth/guards.ts`
- `lib/auth/server.ts`
- `app/dashboard/settings/telegram/*`
- `lib/telegram/*`

**Acceptance**

- `super_admin` can inspect and mutate Telegram integration settings through a supported path;
- no cross-tenant weakening is introduced for normal hotel staff.

### Stage 3 - Integration and security verification

**Goal**

Add the minimum verification layer needed to close PH1-02 acceptance.

**Tasks**

- add integration-oriented checks for hotel-admin save/rotate;
- add manager-denied and super-admin-allowed checks;
- add active/inactive runtime-resolution checks;
- add non-leakage checks for read models and UI-facing metadata;
- document verification commands.

**Expected file areas**

- `tests/ph1-02/*`
- `scripts/*` if a local smoke helper is needed
- `LOCAL_SETUP.md`

**Acceptance**

- PH1-02 has runnable verification beyond helper-only unit checks;
- access and secret-handling rules are demonstrably enforced.

---

## Acceptance Criteria

This hardening spec is complete only if:

1. Telegram settings no longer present webhook setup as fully live before PH1-03;
2. the reserved webhook route clearly communicates pre-ingestion behavior;
3. internal `super_admin` can inspect and manage Telegram integration settings;
4. `manager` cannot mutate integration settings;
5. verification covers hotel-admin, manager, and super-admin permission scenarios;
6. verification covers inactive integration runtime behavior;
7. verification confirms that plaintext tokens do not appear in UI/read models;
8. existing runtime lookup contracts remain compatible with later features.

---

## Test Plan

### Unit checks

- webhook URL derivation still works after hardening;
- sanitized Telegram errors still redact secret-looking token material;
- integration summary/read model excludes secret fields.

### Integration checks

- hotel-admin can create or rotate integration and see success metadata;
- hotel-admin can deactivate active integration;
- manager mutation attempt is rejected;
- super-admin management path is allowed;
- inactive integration is excluded from active resolution;
- reserved webhook route rejects inactive or invalid-secret traffic.

### Security checks

- plaintext token never appears in flash messages, page metadata, or summary cards;
- reserved webhook route does not claim guest messages were ingested;
- `super_admin` support does not bypass tenant scoping for hotel-admin flows.

---

## File Targets

- `app/dashboard/settings/telegram/page.tsx`
- `app/dashboard/settings/telegram/actions.ts`
- `app/api/webhooks/telegram/[webhookPathToken]/route.ts`
- `lib/telegram/integrations.ts`
- `lib/auth/guards.ts`
- `lib/auth/server.ts`
- `tests/ph1-02/*`
- optional: `LOCAL_SETUP.md`

---

## Rationale

This work is required not because PH1-02 lacks core functionality, but because the current implementation still has:

- one operational safety hazard;
- one contract mismatch against the spec;
- one verification gap.

Closing these items now is cheaper and safer than discovering them while building PH1-03 inbound ingestion on top of a partially-finished integration layer.

---

## Definition of Done

This hardening spec is complete now that:

- all acceptance criteria in the parent spec still satisfied;
- this hardening spec accepted;
- `PH1-02` status has been updated from `In Progress` to `Completed`.
