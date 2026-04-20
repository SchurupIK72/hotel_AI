# PH1-10 Release Handoff Evidence

## Purpose

This document defines the minimum evidence package for a Phase 1 release candidate after `verify:ph1-10` is available.

It is intentionally compact: the goal is to help one teammate decide whether the candidate is ready, blocked, or still waiting on manual sign-off.

## Acceptance Matrix

| Key | Criterion | Owner | Automated proof | Manual proof |
| --- | --- | --- | --- | --- |
| `tenant_safe_hotel_access` | tenant-safe hotel access | PH1-02 | `npm.cmd run test:ph1-02` | demo hotel sign-in and hotel-scoped dashboard access |
| `telegram_integration_readiness` | Telegram integration readiness | PH1-02 | `npm.cmd run test:ph1-02` | none |
| `inbound_message_persistence` | inbound message persistence | PH1-03 | `npm.cmd run verify:ph1-03` | none |
| `inbox_workspace_rendering` | inbox visibility and conversation detail rendering | PH1-04 | `npm.cmd run verify:ph1-04` | workspace route smoke in `LOCAL_SETUP.md` |
| `conversation_operations` | assignment, unread-clear, and status-change operations | PH1-05 | `npm.cmd run verify:ph1-05` | inbox operations walkthrough in `LOCAL_SETUP.md` |
| `knowledge_governance_publish_state` | knowledge governance and publish-state behavior | PH1-06 | `npm.cmd run verify:ph1-06` | knowledge authoring walkthrough in `LOCAL_SETUP.md` |
| `retrieval_evidence_boundaries` | retrieval evidence boundaries | PH1-07 | `npm.cmd run verify:ph1-07` | retrieval walkthrough in `LOCAL_SETUP.md` |
| `ai_draft_generation_and_suppression` | AI draft generation and safe suppression | PH1-08 | `npm.cmd run verify:ph1-08` | draft panel walkthrough in `LOCAL_SETUP.md` |
| `human_approved_outbound_send` | human-approved outbound send | PH1-09 | `npm.cmd run verify:ph1-09` | reply flow walkthrough in `LOCAL_SETUP.md` |
| `draft_selection_and_send_audit` | audit trail for draft selection and send outcome | PH1-10 | `npm.cmd run test:ph1-10` | event evidence review for one conversation |
| `outbound_failure_handling` | safe failure handling for outbound delivery | PH1-09 | `npm.cmd run verify:ph1-09` | operator review of retryable and ambiguous outcomes |
| `local_release_walkthrough` | documented residual manual local checks | PH1-10 | none | final PH1 release walkthrough in `LOCAL_SETUP.md` |

## Release Gate

The minimum automated release gate is:

```powershell
npm.cmd run verify:ph1-10
```

A candidate is automation-ready only when:

- the command exits successfully;
- the output contains `Phase 1 release outcome: PASS`;
- no acceptance item is marked `[fail]`.

The gate is blocked when:

- any acceptance item is marked `[fail]`;
- local Supabase schema or demo membership is stale and prevents a required smoke from running;
- the output is incomplete enough that the owning acceptance item cannot be identified.

## Manual Residual Checks

These checks are still human-owned even after the release gate passes:

1. Sign in as the demo hotel admin and confirm the dashboard remains hotel-scoped.
2. Open the inbox and confirm supported, suppressed, retryable, and ambiguous PH1 smoke conversations render understandable operator state.
3. Confirm reply feedback and audit-friendly UI text do not expose secrets or raw provider payloads.
4. Confirm the team understands any `[manual]` entries printed by `verify:ph1-10`.

## Handoff Packet

Before merge or pilot handoff, capture the following:

1. Branch name and commit hash under review.
2. Date of the verification run.
3. The final `verify:ph1-10` output or a short summary of each `[pass]` and `[manual]` line.
4. Confirmation that `LOCAL_SETUP.md` was the source of truth for the operator walkthrough.
5. Any residual manual notes, including whether a local Supabase restart or re-bootstrap was required.

## Failure Triage Notes

- If `verify:ph1-10` fails because `demo:bootstrap` cannot talk to local auth right after `supabase:reset`, restart the Supabase stack and rerun bootstrap before treating the issue as an application regression.
- If a smoke fails on a missing column or stale schema, rerun `npm.cmd run supabase:reset` before debugging app code.
- If a single acceptance item fails while the rest pass, treat that owning feature spec as the first debugging boundary.
