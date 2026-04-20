# PH1-10 - Observability, Audit, and Release Acceptance

> **Created:** 2026-04-20
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P1
> **Status:** In Progress
> **Depends on:** PH1-03 - Inbound Messaging Ingestion, PH1-08 - AI Draft Generation, PH1-09 - Human-Approved Outbound Reply Flow

---

## Summary

PH1-10 turns the existing Phase 1 slices into a releaseable product by making operational traces queryable, audit trails attributable, and acceptance checks reproducible.

It does not add a new guest-facing product workflow.

Instead, it defines the release-readiness layer that proves Phase 1 behavior across inbound ingestion, knowledge retrieval, AI draft generation, human-approved send, and tenant safety.

Without this feature, the product may appear functional in isolated demos, but the team cannot reliably answer whether:

- the correct audit trail exists for one conversation;
- a failure is observable and attributable;
- the local smoke setup covers the true Phase 1 acceptance criteria;
- the pilot is safe to release with evidence instead of intuition.

---

## Product Intent

Phase 1 is only complete when its safety boundary and operational trail are observable after the fact.

PH1-10 exists to make the Copilot release measurable, debuggable, and reviewable by hotel operators and the internal rollout team.

### Must-have outcomes

- key Phase 1 events are emitted in a stable, queryable, tenant-scoped format;
- one operator can reconstruct the lifecycle of an inbound message, retrieved evidence, AI draft generation, draft selection, and final outbound send;
- local seed data and smoke verification cover realistic supported, suppressed, success, retryable-failure, and ambiguous-failure scenarios;
- the project contains a concrete acceptance checklist mapped back to Phase 1 product criteria;
- release readiness can be validated without relying on production traffic or live Telegram delivery.

### Out of scope

- business intelligence dashboards;
- long-term analytics warehousing;
- cost attribution or token accounting dashboards;
- experimentation platforms or A/B testing;
- full support-agent case management beyond the existing event log model;
- production alert routing to PagerDuty, Slack, or external incident systems.

---

## Product Rules

### Audit-completeness rule

For every critical Copilot path in Phase 1, the system must leave enough structured evidence to answer:

- what happened;
- to which hotel and conversation;
- which staff user initiated the action when a human action existed;
- whether the outcome was success, suppression, retryable failure, or ambiguous failure.

### Queryable-evidence rule

Observability is not satisfied by freeform console logs alone.

Critical Phase 1 events must remain queryable from durable records such as `event_logs`, normalized domain rows, or deterministic verification artifacts.

### Release-gate rule

PH1-10 must define a release-acceptance gate that maps each Phase 1 business-critical criterion to at least one verification source:

- helper check;
- smoke verification script;
- manual local verification path.

### Reproducible-verification rule

Release checks must be runnable against the local Supabase environment with seeded or fixture-created data.

The project must not require live production Telegram traffic to validate Phase 1 acceptance.

### Tenant-safe-observability rule

Observability must preserve hotel scoping.

No audit view, verification script, or structured payload may reveal foreign-tenant data while proving a local hotel scenario.

### Sanitized-payload rule

PH1-10 must not log plaintext Telegram bot tokens, raw secret values, or unsafe payload fragments that are unnecessary for support and audit use.

### Append-only-event rule

Operational event records should be treated as append-only evidence.

Fixture cleanup for smoke scripts is allowed, but production-facing feature logic must not depend on rewriting historical event meaning.

### Acceptance-truth rule

PH1-10 must not claim release readiness based only on happy-path UI rendering.

The release gate must explicitly cover at least:

- duplicate inbound handling;
- retrieval evidence attribution;
- safe draft suppression;
- human-approved outbound send;
- retryable outbound failure;
- ambiguous outbound failure;
- tenant-safe access boundaries.

---

## Domain Scope

### Existing domain records consumed by this feature

- `event_logs`
- `messages`
- `conversations`
- `guests`
- `ai_drafts`
- `channel_integrations`
- `hotel_users`
- published knowledge entities from PH1-06 and PH1-07

### Existing dependencies

- PH1-02 Telegram integration configuration and secret boundaries
- PH1-03 inbound message persistence and `event_logs`
- PH1-04 inbox workspace rendering
- PH1-05 assignment and status-change events
- PH1-06 knowledge governance events
- PH1-07 retrieval evidence summaries
- PH1-08 draft persistence and generation metadata
- PH1-09 outbound reply state transitions and delivery classifications

### New persistence and artifact requirements

PH1-10 should prefer the existing `event_logs` table plus deterministic scripts and documentation over introducing a large analytics subsystem.

The preferred Phase 1 direction is:

- normalize event naming and payload expectations in one audit contract;
- keep event payloads compact but attributable;
- add only the minimum seed, fixture, and report artifacts required to prove release acceptance locally.

If an extra helper artifact is needed, it should be narrow and verification-oriented, such as:

- a release checklist markdown file;
- a smoke report generator;
- a compact acceptance summary script output.

### Downstream output of this feature

The result of PH1-10 should allow the team to answer, for one local or pilot hotel:

- which Phase 1 flows work end to end;
- which events and database records prove that behavior;
- whether unresolved gaps are product-risk, observability-risk, or QA-risk.

---

## Audit and Event Requirements

### Canonical-event rule

PH1-10 must define one canonical event catalog for the existing Phase 1 operational events so later debugging and audit do not depend on ad hoc event naming.

The minimum catalog should cover:

- `telegram_webhook_received`
- `telegram_webhook_rejected`
- `telegram_webhook_ignored`
- `message_inbound_saved`
- `message_inbound_deduplicated`
- `guest_created`
- `guest_resolved`
- `conversation_created`
- `conversation_resolved`
- `conversation_status_changed`
- `conversation_assigned`
- `conversation_unassigned`
- `conversation_unread_cleared`
- `kb_retrieval_requested`
- `kb_retrieval_completed`
- `ai_drafts_generated`
- `ai_drafts_suppressed`
- `conversation_draft_selected`
- `outbound_reply_send_requested`
- `outbound_reply_sent`
- `outbound_reply_failed`

### Event-envelope requirement

Every critical Phase 1 event should preserve a stable envelope equivalent to:

```ts
type Phase1AuditEvent = {
  hotelId: string | null;
  integrationId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
```

The exact schema may follow the existing `event_logs` table, but PH1-10 must make the meaning of these fields explicit.

### Actor-attribution requirement

When the triggering action comes from hotel staff, the structured payload should preserve the initiating staff identity in a machine-readable form equivalent to:

- `actorHotelUserId`

This is required at least for:

- conversation assignment and unassignment;
- conversation status changes;
- draft selection;
- outbound send request;
- outbound send success;
- outbound send failure.

### Correlation requirement

PH1-10 should preserve enough correlation data to stitch together one Phase 1 lifecycle without relying on fuzzy timestamp matching alone.

The preferred minimum direction is to include identifiers such as:

- `conversationId`
- `messageId`
- `draftId`
- `sourceDraftId`
- `operationKey`
- `integrationId`

### Compact-payload requirement

Payloads must remain useful but compact.

PH1-10 should prefer identifiers, summary labels, and safe evidence summaries over raw provider payloads or large freeform blobs.

### Retrieval-audit requirement

Retrieval observability must preserve:

- the triggering conversation or message;
- whether evidence was found;
- a compact evidence summary or reference set;
- enough data to explain why a generated draft was knowledge-backed or downgraded.

### Outbound-audit requirement

For human-approved sends, audit evidence must be sufficient to reconstruct:

- whether the reply was manual or draft-backed;
- which draft was selected if any;
- who initiated the send;
- whether Telegram accepted the send;
- whether a failure was retryable or ambiguous.

---

## Release Acceptance Requirements

### Acceptance-traceability-matrix requirement

PH1-10 must produce one acceptance matrix that maps each business-critical Phase 1 criterion to:

- the owning feature spec;
- the verification source;
- the expected proof artifact.

The matrix should cover at least:

1. tenant-safe hotel access
2. Telegram integration readiness
3. inbound message persistence
4. inbox visibility and conversation detail rendering
5. knowledge governance and publish-state behavior
6. retrieval evidence boundaries
7. AI draft generation and safe suppression
8. human-approved outbound send
9. audit trail for draft selection and send outcome
10. safe failure handling for outbound delivery

### Verification-source requirement

Each acceptance item must be backed by one or more of:

- `tests/ph1-*` helper checks;
- `scripts/verify-ph1-*.ts|mjs` smoke scripts;
- documented manual local steps in `LOCAL_SETUP.md`.

### Release-summary requirement

The project should expose one release verification path equivalent to:

```ts
type Phase1ReleaseCheckResult = {
  outcome: "pass" | "fail";
  checks: Array<{
    key: string;
    status: "pass" | "fail" | "manual";
    evidence: string;
  }>;
};
```

The exact implementation may vary, but PH1-10 must provide a compact release verdict rather than a loose collection of unrelated scripts.

### Negative-scenario requirement

Release acceptance is incomplete unless it explicitly verifies failure and suppression paths.

At minimum, PH1-10 must cover:

- duplicate inbound delivery;
- no-evidence or unsupported AI draft suppression;
- outbound retryable failure;
- outbound ambiguous failure;
- foreign-tenant or invalid-resource rejection behavior.

---

## Seed and Fixture Requirements

### Realistic-demo-data requirement

PH1-10 should provide a reproducible local dataset that supports realistic verification scenarios rather than a single happy-path row.

The preferred minimum scenario set is:

- one supported informational conversation with published knowledge and generated drafts;
- one informational conversation with insufficient evidence and cautious fallback behavior;
- one unsupported transactional or sensitive conversation with draft suppression;
- one sent outbound reply linked to `source_draft_id`;
- one retryable outbound failure attempt;
- one ambiguous outbound failure attempt;
- one conversation operation scenario covering assignment or status change.

### Isolation-friendly-fixture requirement

Smoke scripts must be able to create, identify, and clean up their own fixture rows without breaking unrelated seeded local data for the same demo hotel.

### Stable-fixture-naming requirement

Fixture rows created by scripts should follow deterministic naming or ID conventions so failures are debuggable and cleanup is predictable.

---

## Verification and Documentation Contracts

### Required verification scripts

PH1-10 should define or extend verification surfaces such as:

- `tests/ph1-10/*`
- `scripts/verify-ph1-09-smoke.ts`
- `scripts/verify-ph1-10-smoke.ts`
- `package.json`
- `LOCAL_SETUP.md`

### Verification-orchestrator requirement

The preferred Phase 1 direction is for `verify:ph1-10` to act as a release-oriented orchestrator that either:

- runs the required underlying smoke checks in a deterministic sequence;
- or verifies that the underlying artifacts and event proofs exist for the release matrix.

### Local-operator-guidance requirement

`LOCAL_SETUP.md` must describe how one operator can validate the final Phase 1 release locally, including:

- environment setup;
- seed/bootstrap requirements;
- which smoke commands to run;
- which manual checks still remain;
- what outcome indicates release readiness versus a blocking failure.

### Evidence-reporting requirement

Verification outputs should be understandable without opening the entire codebase.

When a release check fails, the output should name:

- which acceptance item failed;
- which verification step detected it;
- which artifact or event was missing or mismatched.

---

## Security and Tenant Safety

### Safe-audit-read rule

Hotel staff may read only event evidence for their own `hotel_id`.

PH1-10 must not weaken existing `event_logs` tenant boundaries to make QA easier.

### Secret-redaction rule

Audit payloads, smoke script outputs, and release reports must not include:

- plaintext Telegram bot tokens;
- service-role keys;
- raw secret env values;
- unnecessary provider payloads containing credential-like strings.

### Foreign-resource rule

Acceptance scripts must verify that foreign-tenant or invalid-resource actions fail safely without leaking the existence of those resources.

### Supportability-without-secret-leak rule

PH1-10 should leave enough context to debug a failed flow without requiring operators to inspect secrets or raw provider payloads.

---

## Application Interfaces

### Required backend helpers

Expected helpers or equivalent implementation surfaces are likely to include:

- `createEventLog(...)`
- `createEventLogSafely(...)`
- one event-catalog normalization helper or shared payload builder
- one acceptance-report or release-summary helper
- one fixture or smoke support helper for PH1-10 scenarios

### Required frontend or operator-facing surfaces

PH1-10 does not require a production analytics dashboard.

The preferred Phase 1 direction is:

- scripted verification;
- release checklist documentation;
- optional lightweight debug or admin-facing readouts only if already aligned with existing patterns.

### Required file areas

Expected implementation areas are likely to include:

- `lib/events/*`
- `lib/conversations/*`
- `lib/copilot/*`
- `lib/telegram/*`
- `scripts/*`
- `tests/ph1-10/*`
- `supabase/seed.sql`
- `package.json`
- `LOCAL_SETUP.md`

---

## Implementation Plan

### Stage 1 - Event catalog normalization and audit contract hardening

**Goal**

Define the canonical Phase 1 event inventory and ensure critical payloads are attributable, compact, and tenant-safe.

**Tasks**

- define the required event catalog for Phase 1 flows;
- normalize minimum payload expectations for actor, correlation, and outcome fields;
- verify existing event emission points against the catalog;
- close obvious audit gaps across conversation, retrieval, draft, and outbound send events.

**Expected file areas**

- `lib/events/*`
- `lib/conversations/*`
- `lib/copilot/*`
- `lib/telegram/*`
- `tests/ph1-10/*`

**Acceptance**

- the team can trace one Phase 1 lifecycle from inbound to outbound using stable event names and identifiers;
- critical events carry enough actor and correlation data for support and audit use.

### Stage 2 - Seed data and fixture-backed observability scenarios

**Goal**

Create reproducible local scenarios that exercise the Phase 1 happy path and safety paths without depending on production traffic.

**Tasks**

- extend seed or fixture coverage for representative Copilot scenarios;
- add stable fixture conventions for PH1-10 smoke scripts;
- ensure cleanup logic does not remove unrelated local hotel data;
- preserve realistic relationships between conversations, messages, drafts, and events.

**Expected file areas**

- `supabase/seed.sql`
- `scripts/*`
- `tests/ph1-10/*`

**Acceptance**

- local verification can reproduce supported, suppressed, retryable-failure, and ambiguous-failure flows consistently;
- smoke fixtures remain deterministic and debuggable.

### Stage 3 - Release acceptance automation and proof output

**Goal**

Turn the Phase 1 acceptance checklist into a runnable release gate with readable pass/fail evidence.

**Tasks**

- define the acceptance-traceability matrix;
- add `verify:ph1-10` or equivalent release-oriented verification command;
- aggregate or coordinate the required underlying smoke checks;
- surface failures by acceptance item rather than only by raw stack trace.

**Expected file areas**

- `scripts/verify-ph1-10-smoke.ts`
- `package.json`
- `tests/ph1-10/*`

**Acceptance**

- one command can produce a release-oriented verdict for the critical Phase 1 scope;
- failing scenarios point to the missing event, artifact, or acceptance condition.

### Stage 4 - Local QA guidance and release handoff evidence

**Goal**

Document how the rollout team verifies the pilot locally and what evidence constitutes release readiness.

**Tasks**

- add PH1-10 local verification guidance to `LOCAL_SETUP.md`;
- document the final acceptance matrix and manual residual checks;
- identify which checks are automated versus manual;
- define the minimum release evidence expected before merge or pilot handoff.

**Expected file areas**

- `LOCAL_SETUP.md`
- `.ai/specs/phase1/*`
- `scripts/*`

**Acceptance**

- one teammate can reproduce the final Phase 1 acceptance flow from local setup documentation;
- release readiness is described as explicit evidence, not as tribal knowledge.

---

## Acceptance Criteria

This feature is complete only if:

1. the project defines one canonical event catalog for the critical Phase 1 operational flows;
2. event evidence is queryable and tenant-scoped for one hotel lifecycle from inbound message through outbound send;
3. draft selection and outbound send outcomes are attributable to the initiating hotel staff user;
4. event payloads remain compact and sanitized, without secret leakage;
5. local verification covers supported, suppressed, retryable-failure, and ambiguous-failure scenarios;
6. release acceptance is mapped to explicit business-critical Phase 1 criteria rather than ad hoc demos;
7. one release-oriented verification path can produce a pass/fail verdict with understandable evidence;
8. `LOCAL_SETUP.md` documents how to run the final local acceptance flow;
9. acceptance checks verify safety boundaries such as tenant isolation and no hidden auto-send behavior;
10. the team can review a Phase 1 release candidate using durable audit evidence, not only UI screenshots or manual memory.

---

## Test Plan

### Unit tests

- event-catalog helpers validate required event names and minimum payload fields;
- release-summary helpers map pass/fail evidence deterministically;
- smoke-fixture helpers create stable scenario identifiers and cleanup targets safely.

### Integration tests

- event logs for one supported informational conversation can be queried and stitched together across retrieval, draft generation, draft selection, and send success;
- outbound retryable failure and ambiguous failure both produce distinct audit evidence;
- foreign-tenant or invalid-resource operations fail safely without observability leakage;
- acceptance-report generation marks missing required evidence as a release failure.

### Smoke checks

- `verify:ph1-10` proves the final Phase 1 release matrix or fails with named acceptance gaps;
- underlying smoke scripts confirm the required artifacts for inbound, retrieval, draft generation, and outbound send paths;
- seeded or fixture-backed data remains deterministic across repeated local runs.

### Manual checks

- operator follows `LOCAL_SETUP.md` and confirms the documented release flow matches actual local behavior;
- audit evidence for one conversation is readable without secrets or ambiguous entity ownership;
- residual manual checks are explicitly labeled as manual and not mistaken for automated proof.

---

## Verification Commands

Core checks once implementation begins:

- `npm.cmd run typecheck`
- `npm.cmd run test:ph1-03`
- `npm.cmd run test:ph1-08`
- `npm.cmd run test:ph1-09`
- `npm.cmd run test:ph1-10`

Release-oriented smoke checks once PH1-10 is wired:

- `npm.cmd run verify:ph1-03`
- `npm.cmd run verify:ph1-04`
- `npm.cmd run verify:ph1-06`
- `npm.cmd run verify:ph1-07`
- `npm.cmd run verify:ph1-08`
- `npm.cmd run verify:ph1-09`
- `npm.cmd run verify:ph1-10`

Execution notes:

- `verify:ph1-10` should rely on local Supabase data and safe stubs where live Telegram delivery would otherwise be required;
- the final release verdict should fail on missing required proof, not only on thrown runtime exceptions;
- verification output should name the acceptance criterion or scenario that failed.

---

## Dependencies and Handoffs

### Dependency on PH1-03

PH1-10 depends on the existing `event_logs` foundation and inbound observability records.

It should not redefine inbound persistence semantics, only the auditability and release-readiness layer above them.

### Dependency on PH1-08

PH1-08 owns draft generation and metadata persistence.

PH1-10 consumes that metadata to verify:

- evidence attribution;
- safe suppression;
- draft lifecycle auditability.

### Dependency on PH1-09

PH1-09 owns draft selection, human-approved outbound sending, and delivery failure semantics.

PH1-10 consumes those contracts to prove:

- manual versus draft-backed send traceability;
- retryable versus ambiguous failure evidence;
- no hidden-send regressions in the release candidate.

### Release handoff

PH1-10 should end with a release-ready package of:

- stable event catalog expectations;
- deterministic local verification;
- explicit acceptance mapping;
- documented local release checklist.

---

## Open Assumptions Locked for This Spec

- `event_logs` remains the primary durable observability record for Phase 1 operations.
- Phase 1 needs structured operational evidence, but not a full analytics product.
- Local verification may stub Telegram send outcomes where live delivery would be unsafe or nondeterministic.
- Release acceptance must cover safety and failure paths, not only happy-path demos.
- The internal rollout team values reproducible proof over broad dashboarding in Phase 1.
