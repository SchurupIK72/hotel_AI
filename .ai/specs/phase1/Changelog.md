## 2026-05-05

### Local Docker and Auth Runtime Hardening

- Fixed the Docker-local Supabase runtime path so browser clients keep using `NEXT_PUBLIC_SUPABASE_URL`, while server-side code inside the app container now resolves Supabase through a dedicated server URL override in [lib/env.ts](../../lib/env.ts), [lib/supabase/server.ts](../../lib/supabase/server.ts), [lib/supabase/admin.ts](../../lib/supabase/admin.ts), and [docker-compose.yml](../../docker-compose.yml).
- Hardened dashboard auth redirects so unauthenticated requests no longer surface a server `AuthenticationRequiredError` on `/dashboard` and now fall back cleanly to `/sign-in` via [lib/auth/errors.ts](../../lib/auth/errors.ts), [lib/auth/guards.ts](../../lib/auth/guards.ts), and [app/dashboard/layout.tsx](../../app/dashboard/layout.tsx).
- Extended local operator guidance in [LOCAL_SETUP.md](../../LOCAL_SETUP.md) to document the browser-versus-container Supabase URL split for Docker-based app runs.

## 2026-05-05

### PH1-09 - Human-Approved Outbound Reply Flow

- Completed the Phase 1 outbound reply implementation in [ph1-09-approved-reply-flow.md](./ph1-09-approved-reply-flow.md), including draft-backed and manual Telegram reply sending from the inbox workspace.
- Hardened the reply composer so empty replies cannot be sent, pending sends show explicit in-flight feedback, retryable failures can be retried intentionally, and ambiguous delivery outcomes no longer expose a blind resend path.
- Synced the PH1-09 spec status to `Completed` and recorded the finished verification surface through `test:ph1-09` and `verify:ph1-09`.

## 2026-04-20

### PH1-10 - Observability, Audit, and Release Acceptance

- Added canonical Phase 1 audit contracts and payload expectations in [lib/events/catalog.ts](../../lib/events/catalog.ts) and [lib/events/release-matrix.ts](../../lib/events/release-matrix.ts).
- Hardened structured event logging in [lib/events/event-logs.ts](../../lib/events/event-logs.ts) and outbound reply audit payloads in [lib/conversations/replies.ts](../../lib/conversations/replies.ts).
- Added release verification coverage in [tests/ph1-10/run-checks.ts](../../tests/ph1-10/run-checks.ts), [scripts/verify-ph1-09-smoke.ts](../../scripts/verify-ph1-09-smoke.ts), and [scripts/verify-ph1-10-smoke.ts](../../scripts/verify-ph1-10-smoke.ts).
- Extended release and operator documentation in [LOCAL_SETUP.md](../../LOCAL_SETUP.md), [ph1-10-observability-and-qa.md](./ph1-10-observability-and-qa.md), and [ph1-10-release-handoff-evidence.md](./ph1-10-release-handoff-evidence.md).

## 2026-04-19

### PH1-09 - Human-Approved Outbound Reply Flow

- Added the Phase 1 outbound reply spec in [ph1-09-approved-reply-flow.md](./ph1-09-approved-reply-flow.md) covering draft selection, manual reply composition, Telegram send contracts, delivery states, and audit requirements.
- Locked the human-approval boundary for Phase 1: no AI draft may be sent without an explicit operator action, and final outbound text must come from the reviewed editor value.
- Marked the feature as `In Progress`; the spec is ready for implementation handoff, but the changelog does not treat PH1-09 as complete yet.

## 2026-04-18

### Phase 1 Audit Remediation

- Added the follow-up remediation spec in [phase1-audit-remediation-2026-04-18.md](./phase1-audit-remediation-2026-04-18.md) to close audit gaps without changing the core Phase 1 product scope.
- Captured required parity work for `super_admin` Telegram settings access, PH1-02 access-matrix verification depth, PH1-01 smoke tolerance, and PH1-04 deterministic smoke isolation.
- Locked the expectation that existing Telegram runtime contracts remain backward-compatible while access resolution and local verification are hardened.

## 2026-04-17

### PH1-08 - AI Draft Generation

- Added persistent `ai_drafts` storage, draft state contracts, and workspace integration requirements in [ph1-08-ai-draft-generation.md](./ph1-08-ai-draft-generation.md).
- Recorded completion of generation orchestration, safety gating, duplicate auto-generation protection, workspace draft rendering, manual regenerate flow, and `verify:ph1-08`.
- Established the PH1-08 to PH1-09 handoff boundary: drafts are generated and rendered here, while send approval and outbound delivery start in PH1-09.

### PH1-07 - Knowledge Retrieval for Copilot

- Added tenant-scoped retrieval contracts, published-only evidence rules, policy-over-FAQ precedence, and fallback states in [ph1-07-knowledge-retrieval.md](./ph1-07-knowledge-retrieval.md).
- Recorded completion of deterministic candidate loading, ranking, compact retrieval evidence summaries, retrieval event emission, and `verify:ph1-07`.
- Locked the PH1-07 handoff contract so downstream draft generation consumes normalized retrieval refs instead of rebuilding retrieval logic.

### PH1-06 - Knowledge Base Management

- Added Phase 1 knowledge management requirements in [ph1-06-knowledge-management.md](./ph1-06-knowledge-management.md) for hotel-scoped FAQ and policy CRUD with publish governance.
- Recorded completion of FAQ and policy schema, RLS, admin dashboard management UI, publish and unpublish actions, attribution metadata, and `verify:ph1-06`.
- Established published knowledge as the governed source of truth for PH1-07 retrieval and PH1-08 draft generation.

### PH1-05 - Conversation Operations

- Added conversation operation contracts in [ph1-05-conversation-operations.md](./ph1-05-conversation-operations.md) for assignment, status changes, unread clearing, and inbox filters.
- Recorded completion of tenant-safe mutation helpers, same-hotel assignee validation, `all` / `unread` / `assigned_to_me` filters, workspace controls, and `verify:ph1-05`.
- Locked unread clearing to an explicit conversation-open rule so filters and workspace state remain deterministic.

### PH1-04 - Conversation Workspace UI

- Added the first usable inbox workspace spec in [ph1-04-conversation-workspace.md](./ph1-04-conversation-workspace.md) covering tenant-safe list and detail routes, guest summary, timeline, and draft panel boundary.
- Recorded completion of inbox read models, `/dashboard/inbox` routes, protected navigation, conversation detail rendering, draft placeholder panel, and `verify:ph1-04`.
- Established PH1-04 as the shared workspace surface later extended by PH1-05 operations, PH1-08 drafts, and PH1-09 replies.

## 2026-04-16

### PH1-03 - Inbound Messaging Ingestion

- Added live Telegram webhook ingestion requirements in [ph1-03-inbound-ingestion.md](./ph1-03-inbound-ingestion.md) for parsing, tenant-safe hotel resolution, guest and conversation creation, and idempotent message persistence.
- Recorded completion of `guests`, `conversations`, and `messages` schema, active webhook route behavior, duplicate-delivery protection, structured ingestion events, and `verify:ph1-03`.
- Established the normalized messaging records that PH1-04 through PH1-10 depend on for workspace, retrieval, draft generation, outbound replies, and audit trails.

## 2026-04-13

### PH1-02 Completion Hardening

- Added the PH1-02 follow-up hardening spec in [ph1-02-completion-hardening.md](./ph1-02-completion-hardening.md) to close safety and verification gaps after the core Telegram integration slice shipped.
- Captured required reserved-webhook safety messaging, explicit `super_admin` ownership parity, manager mutation denial, and stronger PH1-02 verification coverage.
- Marked the Telegram integration slice as complete only after these operational and verification gaps were closed.

## 2026-04-12

### PH1-02 - Hotel Setup and Telegram Integration

- Added Telegram integration requirements in [ph1-02-telegram-setup.md](./ph1-02-telegram-setup.md) covering `channel_integrations`, encrypted bot-token storage, active integration lookup, verification via `getMe`, and stable webhook routing.
- Recorded completion of the protected Telegram settings surface, hotel-admin save and rotate flow, deactivate action, runtime helpers, and `verify:ph1-02`.
- Established the shared Telegram runtime contracts used later by inbound webhook handling and outbound send flows.

### PH1-01 - Tenant Foundation and Staff Access

- Added the tenant and auth foundation spec in [ph1-01-tenant-foundation.md](./ph1-01-tenant-foundation.md) for `hotels`, `hotel_users`, Supabase Auth, access context resolution, and RLS-backed hotel scoping.
- Recorded completion of auth and session guards, protected dashboard routing, same-hotel visibility rules, base RLS coverage, and `verify:ph1-01`.
- Established the tenant-safe access pattern reused by every later Phase 1 feature.
