# Phase 1 Audit Remediation - Access Parity and Verification Hardening

> **Created:** 2026-04-18
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** Completed
> **Depends on:** PH1-01, PH1-02, PH1-04

---

## Summary

This remediation spec captures the concrete follow-up work required after the 2026-04-18 audit of the current Phase 1 specs and implementation.

The audit confirmed that the main functional slices of Phase 1 are already in place:

- tenant foundation and hotel-scoped access;
- Telegram integration storage and runtime lookup;
- inbound ingestion;
- conversation workspace and operations;
- knowledge management and retrieval;
- AI draft generation and storage.

The remaining gaps are narrower, but they still block a clean "fully verified" Phase 1 status:

1. `PH1-02` still lacks the spec-required `super_admin` management path for Telegram integration settings.
2. `PH1-02` verification is still helper-heavy and does not prove the full role matrix end to end.
3. `PH1-01` smoke verification is brittle when the local Next.js server is not running.
4. `PH1-04` smoke verification is not isolated enough and can validate the wrong conversation in a non-clean local dataset.

This follow-up spec exists to close those gaps without redefining the already implemented Phase 1 product scope.

---

## Product Intent

The intent of this remediation is not to add new hotel functionality.

The intent is to make the existing Phase 1 behavior:

- contract-complete;
- operationally supportable;
- verifiable in a repeatable local environment;
- safe to use as the base for PH1-09 and later acceptance work.

Phase 1 should exit this remediation with:

- explicit Telegram settings ownership parity;
- deterministic smoke checks;
- stronger verification evidence for spec status decisions.

---

## Stakeholders

- `hotel_admin`
  Needs the existing same-hotel Telegram settings workflow to stay unchanged and safe.

- `super_admin`
  Needs a supported internal path to inspect and repair Telegram integration settings for any hotel during pilot support.

- `manager`
  Must remain blocked from Telegram settings mutation paths.

- engineering / QA
  Need deterministic verification scripts whose failures indicate real regressions rather than local environment noise.

- future PH1-09 / PH1-10 work
  Need trustworthy completion status for the Phase 1 foundation they build on.

---

## Audit Findings

### Finding 1 - Missing `super_admin` access parity for Telegram settings

`PH1-02` says Telegram integration settings may be managed by:

- `hotel_admin`
- internal `super_admin`

Current implementation still gates the settings page and server actions through `requireHotelAdmin()`, so internal `super_admin` users cannot inspect, rotate, or deactivate integrations through a supported path.

### Finding 2 - PH1-01 smoke check fails in a valid local setup

`scripts/verify-ph1-01-smoke.mjs` is intended to tolerate a missing local Next.js server and skip the redirect check.

In practice, the current `fetch()` error handling can still fail the script with `ECONNREFUSED`, even when auth and RLS checks already passed.

This makes the verification result noisy and less trustworthy.

### Finding 3 - PH1-04 smoke check is dataset-sensitive

`scripts/verify-ph1-04-smoke.ts` creates a workspace conversation, but then resolves the selected conversation by "latest activity wins" across the whole hotel dataset.

If another local smoke script created a newer conversation first, the PH1-04 script can validate the wrong guest and fail even though the workspace read model is functioning correctly.

### Finding 4 - PH1-02 verification still lacks role-path depth

Current PH1-02 checks prove helper contracts and token sanitization, but they do not prove the full access matrix:

- `hotel_admin` allowed;
- `manager` denied;
- `super_admin` allowed.

That leaves the spec incomplete relative to the original ownership rule.

---

## Goals

This remediation spec must deliver:

- access behavior for Telegram settings that matches the PH1-02 feature contract;
- deterministic local verification for PH1-01 and PH1-04;
- stronger PH1-02 verification for role-path and secret-handling behavior;
- no regression to tenant safety or existing Phase 1 runtime contracts.

---

## Out of Scope

- redesigning the Telegram integration data model;
- changing PH1-03 inbound ingestion behavior;
- changing PH1-04 workspace UX or conversation ordering rules in production code;
- replacing PH1-08 draft generation behavior;
- PH1-09 outbound send flow;
- introducing public multi-hotel switching for hotel staff.

---

## Chosen Design Direction

### Design choice 1 - Explicit hotel-scoped `super_admin` settings path

The remediation should add one explicit internal path for Telegram settings scope resolution:

- `hotel_admin`: hotel scope is resolved from the signed-in membership, as today;
- `super_admin`: hotel scope is provided explicitly via query param or equivalent server-side route input and then validated on the server.

Recommended route shape:

- `/dashboard/settings/telegram?hotelId=<uuid>`

This keeps the existing UI surface stable while making internal hotel context explicit.

### Design choice 2 - Centralized Telegram settings access resolver

The page and actions should not each implement separate role logic.

They should share one server-side resolver equivalent to:

```ts
type TelegramSettingsAccess =
  | {
      actorKind: "hotel_admin";
      hotelId: string;
      hotelUserId: string;
    }
  | {
      actorKind: "super_admin";
      hotelId: string;
      hotelUserId: null;
      authUserId: string;
    };
```

This resolver must become the single authority for:

- page access;
- create / rotate / deactivate actions;
- Telegram settings data loading.

### Design choice 3 - Deterministic smoke verification by owned fixture identity

Smoke scripts must assert against the records they created, not the globally newest records in the hotel.

The scripts should resolve their target records through fixture-specific identifiers such as:

- known `external_user_id`;
- created `conversation_id`;
- fixture title / slug;
- or other deterministic scoped lookup keys.

---

## Domain Scope

### Existing modules affected by this remediation

- auth / access guards;
- dashboard Telegram settings surface;
- PH1-01 smoke verification;
- PH1-02 verification;
- PH1-04 smoke verification.

### Existing runtime contracts that must remain stable

- `getActiveTelegramIntegration(hotelId)`
- `getTelegramClientConfig({ hotelId | integrationId })`
- existing hotel-admin Telegram save / rotate / deactivate flows
- existing inbox read models and route structure

### New persistence required

No new database tables are required.

This remediation should stay in:

- server-side guard logic;
- page/action scope resolution;
- tests and smoke scripts;
- optionally local docs.

---

## Requirements

### R1 - `super_admin` Telegram settings path

The system must provide a supported server-authoritative path for internal `super_admin` users to:

- inspect non-secret Telegram integration metadata for a chosen hotel;
- save or rotate Telegram integration settings;
- deactivate an active integration.

#### Constraints

- `super_admin` must always operate in an explicit hotel scope;
- the hotel scope must be server-validated before use;
- this path must not weaken same-hotel rules for normal staff users.

#### Acceptance

- `hotel_admin` retains same-hotel management behavior;
- `super_admin` can manage Telegram settings through an explicit hotel-scoped path;
- `manager` still cannot mutate Telegram integration settings.

### R2 - Permission model must remain explicit and centralized

Telegram settings authorization must be enforced centrally on the server.

The client must not become the source of truth for:

- hotel selection authority;
- staff role authority;
- mutation permission.

#### Acceptance

- page load and server actions reuse one shared authorization rule;
- unauthorized paths fail safely without leaking foreign-tenant metadata;
- the codebase does not duplicate Telegram settings role logic across page/action/service layers.

### R3 - `super_admin` hotel context must be explicit in the UI contract

When a `super_admin` opens Telegram settings, the current hotel context must be visible and unambiguous.

At minimum, the UI should show:

- target hotel name or id;
- that the page is being viewed in an internal support context.

#### Acceptance

- an internal operator can tell which hotel they are editing;
- the UI does not look like a normal hotel-admin self-service screen when a `super_admin` is acting cross-hotel.

### R4 - PH1-01 smoke verification must be environment-tolerant

The PH1-01 smoke script must treat an unavailable local Next.js server as a skipped redirect check rather than a failed feature verification.

#### Acceptance

- auth and RLS checks can still pass independently of local web server state;
- missing `http://127.0.0.1:3000` does not fail the script when the only missing piece is the dev server process;
- unexpected HTTP behavior still fails the script when the server is running.

### R5 - PH1-04 smoke verification must be isolated

The PH1-04 smoke script must verify the conversation it created, not whichever conversation currently sorts first for the hotel.

#### Acceptance

- the script locates the created conversation deterministically;
- the result is stable even after other Phase 1 smoke scripts have populated the same hotel;
- the script still exercises the real workspace read-model mapping rather than bypassing it entirely.

### R6 - PH1-02 verification must cover the access matrix

The project must include runnable verification for the Telegram settings ownership model and read-model hygiene.

At minimum, verification must prove:

- `hotel_admin` allowed;
- `manager` denied;
- `super_admin` allowed;
- inactive integrations are excluded from active runtime resolution;
- plaintext bot token never appears in UI-facing metadata or flash outputs.

#### Acceptance

- PH1-02 verification is no longer limited to helper-only checks;
- failures can be traced to a concrete permission or secret-handling rule.

### R7 - Existing runtime contracts must stay stable

The remediation work must preserve the trusted server-side Telegram runtime contracts already used by later features:

- `getActiveTelegramIntegration(hotelId)`
- `getTelegramClientConfig({ hotelId | integrationId })`

#### Acceptance

- no downstream PH1-03 or PH1-09 caller needs a breaking contract change;
- the remediation adds access and verification coverage without changing contract semantics.

---

## Application Contracts

### Telegram settings scope resolver contract

The backend should expose one trusted resolver equivalent to:

```ts
type ResolveTelegramSettingsScopeInput = {
  requestedHotelId?: string | null;
};

type ResolveTelegramSettingsScopeResult =
  | {
      actorKind: "hotel_admin";
      hotelId: string;
      hotelUserId: string;
      hotelRole: "hotel_admin";
    }
  | {
      actorKind: "super_admin";
      hotelId: string;
      hotelUserId: null;
      authUserId: string;
    };
```

Expected behavior:

- `hotel_admin` ignores foreign requested hotel ids and uses membership scope only;
- `super_admin` must provide a valid target hotel id;
- `manager` fails safely.

### Telegram settings page contract

The page should support:

- default hotel-admin entry with membership scope;
- explicit internal support entry for `super_admin` with target hotel scope;
- safe failure if the target hotel does not exist or is not accessible.

### Verification script contract

Smoke scripts should:

- create fixture-scoped records;
- resolve the created records deterministically;
- clean up only the records they own;
- fail only on real contract mismatch, not on unrelated seeded dataset activity.

---

## Implementation Plan

### Stage 1 - Telegram settings access parity

**Goal**

Align PH1-02 behavior with the intended ownership model.

**Tasks**

- add a shared Telegram settings scope resolver;
- allow `super_admin` to access Telegram settings in explicit hotel scope;
- update page loading to consume the resolver instead of `requireHotelAdmin()` directly;
- update save / deactivate server actions to consume the same resolver;
- preserve manager denial behavior;
- add visible target-hotel context for internal support mode.

**Expected file areas**

- `app/dashboard/settings/telegram/page.tsx`
- `app/dashboard/settings/telegram/actions.ts`
- `lib/auth/guards.ts`
- `lib/auth/server.ts`
- optional shared helper under `lib/telegram/*` or `lib/auth/*`

**Acceptance**

- `super_admin` can manage Telegram settings safely;
- same-hotel `hotel_admin` behavior remains unchanged;
- `manager` is still blocked from mutation.

### Stage 2 - PH1-01 smoke hardening

**Goal**

Make PH1-01 verification trustworthy in a normal local setup.

**Tasks**

- harden `verifyDashboardRedirect()` to correctly detect missing local server;
- treat connection refusal as a skipped web-server check, not a spec failure;
- preserve failure for wrong redirect behavior when the server is actually reachable.

**Expected file areas**

- `scripts/verify-ph1-01-smoke.mjs`
- optional `LOCAL_SETUP.md`

**Acceptance**

- PH1-01 smoke no longer fails on harmless local-server absence;
- genuine dashboard redirect regressions still fail.

### Stage 3 - PH1-04 smoke isolation hardening

**Goal**

Make PH1-04 workspace verification deterministic.

**Tasks**

- resolve the fixture-created guest and conversation directly;
- validate workspace mapping for that exact conversation;
- keep the script representative of the actual workspace read-model contract;
- remove dependence on hotel-global latest activity ordering inside the smoke script.

**Expected file areas**

- `scripts/verify-ph1-04-smoke.ts`

**Acceptance**

- PH1-04 smoke passes consistently in a seeded shared hotel dataset;
- failures reflect real workspace contract regressions.

### Stage 4 - PH1-02 verification depth

**Goal**

Prove the Telegram settings access model and secret boundaries end to end.

**Tasks**

- extend PH1-02 checks to cover allowed / denied role paths;
- add a verification path for `super_admin`;
- verify inactive integration exclusion from active runtime resolution;
- verify page-facing summaries and flash outputs exclude plaintext token data;
- document the final verification commands.

**Expected file areas**

- `tests/ph1-02/*`
- `scripts/*`
- `LOCAL_SETUP.md`

**Acceptance**

- PH1-02 has runnable verification for the full role matrix;
- secret-handling guarantees are demonstrable, not only inferred from code review.

---

## File Targets

- `app/dashboard/settings/telegram/page.tsx`
- `app/dashboard/settings/telegram/actions.ts`
- `lib/auth/guards.ts`
- `lib/auth/server.ts`
- optional shared resolver under `lib/auth/*` or `lib/telegram/*`
- `scripts/verify-ph1-01-smoke.mjs`
- `scripts/verify-ph1-04-smoke.ts`
- `tests/ph1-02/*`
- optional `LOCAL_SETUP.md`

---

## Acceptance Criteria

This remediation spec is complete only if:

1. `super_admin` can manage Telegram integration settings through a supported explicit hotel-scoped path;
2. `hotel_admin` retains the current same-hotel Telegram settings workflow;
3. `manager` remains unable to mutate Telegram integration settings;
4. Telegram settings page and actions share one centralized authorization path;
5. `super_admin` UI makes the target hotel context explicit;
6. PH1-01 smoke verification tolerates a missing local web server correctly;
7. PH1-04 smoke verification deterministically validates the conversation it created;
8. PH1-02 verification covers `hotel_admin`, `manager`, and `super_admin` behavior;
9. PH1-02 verification confirms inactive integrations are excluded from active runtime resolution;
10. PH1-02 verification confirms that plaintext tokens do not leak into UI-facing metadata or flash messages;
11. existing Phase 1 Telegram runtime contracts remain backward-compatible.

---

## Test Plan

### Unit checks

- Telegram settings scope resolver returns hotel-admin scope correctly;
- Telegram settings scope resolver returns super-admin target-hotel scope correctly;
- manager access is rejected safely;
- PH1-02 integration summary / read model excludes secret fields;
- PH1-01 web check treats connection refusal as skip, not failure.

### Integration checks

- hotel-admin can open, save, rotate, and deactivate Telegram integration in their own hotel scope;
- manager cannot mutate Telegram settings;
- super-admin can open and mutate Telegram settings in explicit target-hotel scope;
- inactive integration is excluded from active runtime resolution;
- stored Telegram settings UI never exposes plaintext token state.

### Smoke checks

- `verify:ph1-01` passes with local Supabase even when the Next.js dev server is offline;
- `verify:ph1-04` passes after other Phase 1 smoke scripts have already populated the same hotel;
- any real redirect or workspace-contract regression still causes failure.

### Security checks

- client-facing Telegram settings responses contain only non-secret metadata;
- foreign hotel selection is not available to normal hotel staff;
- `super_admin` support path does not weaken same-hotel guarantees for hotel-admin flows.

---

## Verification Commands

Core checks:

- `npm.cmd run typecheck`
- `npm.cmd run test:ph1-01`
- `npm.cmd run test:ph1-02`
- `npm.cmd run test:ph1-04`

Smoke checks:

- `npm.cmd run verify:ph1-01`
- `npm.cmd run verify:ph1-02`
- `npm.cmd run verify:ph1-04`

Recommended full remediation pass:

- `npm.cmd run typecheck`
- `npm.cmd run test:ph1-01`
- `npm.cmd run test:ph1-02`
- `npm.cmd run test:ph1-04`
- `npm.cmd run verify:ph1-01`
- `npm.cmd run verify:ph1-02`
- `npm.cmd run verify:ph1-04`

---

## Risks and Notes

### Risk 1 - Cross-hotel support path can accidentally become a generic staff bypass

This is why `super_admin` hotel scope must be explicit and centrally resolved.

### Risk 2 - Fixing smoke scripts by over-mocking would reduce their value

The scripts must remain close to real contracts and only remove nondeterminism, not business validation.

### Risk 3 - Verification status can drift again if scripts and spec diverge

Any final remediation implementation should update both:

- spec status language;
- verification commands / notes in local docs where needed.

---

## Definition of Done

This remediation is done only when:

- the Telegram settings ownership contract is fully aligned with PH1-02;
- PH1-01 and PH1-04 smoke checks are deterministic in a normal local environment;
- PH1-02 verification proves the final access matrix and secret hygiene;
- no existing Phase 1 runtime contract is broken;
- Phase 1 status decisions can be made from verification evidence instead of partial inference.
