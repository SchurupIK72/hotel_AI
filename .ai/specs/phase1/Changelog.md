## 2026-04-20

### PH1-10 - Observability, Audit, and Release Acceptance

- Added canonical Phase 1 audit contracts and payload expectations in [lib/events/catalog.ts](../../lib/events/catalog.ts) and [lib/events/release-matrix.ts](../../lib/events/release-matrix.ts).
- Hardened structured event logging in [lib/events/event-logs.ts](../../lib/events/event-logs.ts) and outbound reply audit payloads in [lib/conversations/replies.ts](../../lib/conversations/replies.ts).
- Added release verification coverage in [tests/ph1-10/run-checks.ts](../../tests/ph1-10/run-checks.ts), [scripts/verify-ph1-09-smoke.ts](../../scripts/verify-ph1-09-smoke.ts), and [scripts/verify-ph1-10-smoke.ts](../../scripts/verify-ph1-10-smoke.ts).
- Extended release and operator documentation in [LOCAL_SETUP.md](../../LOCAL_SETUP.md), [ph1-10-observability-and-qa.md](./ph1-10-observability-and-qa.md), and [ph1-10-release-handoff-evidence.md](./ph1-10-release-handoff-evidence.md).
