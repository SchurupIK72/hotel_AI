# PH1-07 - Knowledge Retrieval for Copilot

> **Created:** 2026-04-17
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** In Progress
> **Depends on:** PH1-03 - Inbound Messaging Ingestion, PH1-06 - Knowledge Base Management

---

## Summary

This feature creates the tenant-scoped retrieval layer that turns published hotel knowledge into usable evidence for Copilot.

It defines how the system looks up published FAQ and policy content for an informational guest message, how it formats evidence references, and how it behaves when reliable evidence is missing.

Without this feature, PH1-08 draft generation would either rely on freeform model recall or collapse knowledge lookup and generation into one opaque step.

---

## Product Intent

Phase 1 needs retrieval before generation.

The goal is to give Copilot a small, deterministic evidence layer that can support informational reply drafts without pretending to know transactional or unsupported facts.

### Must-have outcomes

- retrieval is always scoped to the current `hotel_id`;
- only published FAQ and policy items are eligible for evidence;
- retrieval returns normalized evidence references instead of draft text;
- policy knowledge can take precedence when policy and FAQ overlap;
- missing evidence leads to a safe fallback mode, not confident fabrication.

### Out of scope

- embeddings, vector databases, and semantic RAG infrastructure;
- retrieval from draft or unpublished knowledge;
- live transactional tools such as rates, availability, or bookings;
- cross-hotel search;
- direct guest-facing UI for retrieval internals;
- final draft generation, selection, or outbound send.

---

## Product Rules

### Retrieval scope rule

PH1-07 retrieves only from the hotel-scoped knowledge records already governed by PH1-06:

- `faq_items`
- `policy_items`

It must not introduce freeform document retrieval in this iteration.

### Publish eligibility rule

Only records with published state may be returned as retrieval evidence.

Draft or unpublished knowledge must be ignored completely by the retrieval layer.

### Tenant rule

Every retrieval request must stay inside the resolved `hotel_id`.

No retrieval result may include knowledge content or metadata from another hotel.

### Informational-only rule

Retrieval is intended only to support informational guest replies in Phase 1.

It must not be treated as authority for:

- live room availability;
- live pricing;
- booking confirmation or booking status;
- refunds or compensation;
- policy exceptions that require human judgment.

### Precedence rule

When both FAQ and policy knowledge appear relevant to the same guest question, structured policy evidence should take precedence over FAQ evidence where the two materially overlap.

FAQ evidence may still be returned as supporting context when useful.

### No-answer rule

If retrieval cannot find sufficient approved evidence, the system must return an explicit safe fallback mode suitable for:

- clarification wording;
- escalation wording;
- or draft suppression in the next phase.

It must not pretend that weak or missing evidence is sufficient.

### Determinism rule

Given the same hotel-scoped published knowledge set and the same normalized request input, retrieval should produce stable evidence ordering and stable fallback behavior.

---

## Domain Scope

### Existing domain records consumed by this feature

- `conversations`
- `messages`
- `faq_items`
- `policy_items`
- `event_logs`

### Existing dependencies

- PH1-03 normalized guest message persistence
- PH1-06 published knowledge management and governance
- PH1-01 tenant-safe auth, guards, and hotel scoping

### New domain persistence required by this feature

No new core Phase 1 table is strictly required for the retrieval service itself.

This feature may add lightweight retrieval helper structures and event payload conventions, but it should avoid introducing a full document-indexing subsystem.

### Downstream features that depend on this output

- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow
- PH1-10 Observability, audit, and release acceptance

---

## Data Model Requirements

### Source-of-truth requirement

Retrieval must read from the published knowledge records created by PH1-06.

Expected minimum fields used by retrieval include:

- `hotel_id`
- `is_published`
- `published_at`
- title or question field
- answer or body field
- `updated_at`

### Retrieval reference requirement

Retrieval output should normalize evidence into references suitable for later auditability and AI draft persistence.

At minimum, each evidence reference should preserve:

- knowledge item type;
- source item id;
- hotel id;
- short title or label;
- excerpt or normalized content fragment;
- retrieval score or ordering signal;
- whether the source came from policy or FAQ.

### Policy-over-FAQ requirement

The retrieval model must make it possible to identify when evidence came from:

- policy knowledge;
- FAQ knowledge;
- or both.

This is required so PH1-08 can apply safer prompt framing.

### No-answer state requirement

Retrieval must produce an explicit result state for:

- evidence found;
- insufficient evidence;
- no relevant evidence.

This state must be machine-readable by PH1-08.

---

## Retrieval Contracts

### Retrieval request contract

The backend should expose a trusted retrieval operation equivalent to:

```ts
type RetrieveKnowledgeInput = {
  hotelId: string;
  conversationId: string;
  messageId: string;
  messageText: string;
  maxEvidenceItems?: number;
};
```

Expected behavior:

- request runs only in the current hotel scope;
- `messageText` is treated as the retrieval query basis;
- retrieval returns structured evidence, not final reply text.

### Retrieval result contract

The backend should expose a normalized result equivalent to:

```ts
type RetrievalEvidenceRef = {
  itemType: "faq" | "policy";
  itemId: string;
  hotelId: string;
  title: string;
  excerpt: string;
  score: number;
  retrievalReason: "policy_precedence" | "direct_match" | "supporting_match";
};

type RetrievalResult = {
  status: "evidence_found" | "insufficient_evidence" | "no_relevant_evidence";
  guidanceMode: "answer_from_evidence" | "clarify_or_escalate";
  evidence: RetrievalEvidenceRef[];
};
```

Expected behavior:

- `evidence_found` means at least one strong enough published source was found;
- `insufficient_evidence` means weak or partial evidence exists but should not drive a confident factual draft;
- `no_relevant_evidence` means no usable published knowledge was found.

### Observability contract

The retrieval flow should emit structured events equivalent to:

- `kb_retrieval_requested`
- `kb_retrieval_completed`

At minimum, completion logging should preserve:

- `hotel_id`
- `conversation_id`
- `message_id`
- retrieval result status
- evidence reference summary
- evidence count

---

## Retrieval Behavior

### Candidate selection behavior

Retrieval should search only the current hotel's published FAQ and policy items.

The exact matching strategy may evolve, but Phase 1 should favor a lightweight and deterministic approach such as:

- normalized lexical matching;
- keyword overlap;
- field-based weighting;
- policy-first weighting where relevant.

### Evidence ranking behavior

Returned evidence should be ordered from strongest to weakest match using a stable scoring rule.

The exact score formula may vary, but the ordering must be explainable and consistent.

### Evidence count behavior

Phase 1 retrieval should return only a small bounded set of evidence items suitable for later prompt injection.

The default maximum should remain intentionally small, such as 1-5 evidence references.

### Excerpt behavior

Retrieval references should include concise excerpts or normalized content fragments rather than dumping full long-form knowledge bodies into logs or downstream prompt inputs by default.

### Missing-evidence behavior

When strong evidence is not available, retrieval must explicitly steer downstream draft generation toward:

- asking a clarifying question;
- suggesting human follow-up;
- or avoiding a factual answer.

### Unsupported-request behavior

If a guest message appears transactional or otherwise outside the informational scope of Phase 1, retrieval may return no usable evidence even if loosely related knowledge exists.

This is preferred over unsafe confidence.

---

## Security and Tenant Safety

### Server-authoritative rule

All retrieval execution must resolve tenant context on the server side.

The client must not be trusted to declare:

- `hotel_id`
- visibility of unpublished knowledge;
- evidence eligibility.

### Hidden foreign-resource rule

If retrieval runs for a message or conversation outside the current hotel scope, the operation should fail safely without revealing whether the underlying records exist.

### Published-only rule

Retrieval must not return unpublished content, even if it is otherwise a strong textual match.

### Logging hygiene rule

Observability should store compact retrieval references and state, not unnecessarily large raw knowledge payloads.

---

## Application Interfaces

### Required backend helpers

Expected server-side helpers are likely to include:

- `retrieveKnowledge(...)`
- `listPublishedFaqCandidates(...)`
- `listPublishedPolicyCandidates(...)`
- `rankKnowledgeEvidence(...)`
- `createRetrievalReferences(...)`

The exact naming may vary, but retrieval logic should not be duplicated inside PH1-08 prompt-generation code.

### Required frontend surfaces

This feature is primarily backend-facing.

No dedicated end-user UI route is required in Phase 1.

Optional debug or evidence-display surfaces, if added, should remain implementation details rather than a product requirement for this phase.

### Required integration surfaces

Expected implementation areas are likely to include:

- `lib/knowledge/*`
- `lib/conversations/*`
- `lib/events/*`
- `scripts/*`
- `tests/ph1-07/*`

---

## Implementation Plan

### Stage 1 - Retrieval contracts and candidate loaders

**Goal**

Define the Phase 1 retrieval result model and load published same-hotel knowledge candidates safely.

**Tasks**

- add typed retrieval result contracts;
- add published FAQ candidate loader;
- add published policy candidate loader;
- exclude draft and foreign-tenant knowledge;
- normalize candidate records for ranking.

**Expected file areas**

- `lib/knowledge/*`
- `types/*`
- `tests/ph1-07/*`

**Acceptance**

- retrieval candidate loading is tenant-safe and published-only;
- candidate records are normalized for later ranking.

### Stage 2 - Retrieval ranking and precedence rules

**Goal**

Return bounded, deterministic evidence for informational messages.

**Tasks**

- implement lightweight matching over guest message text;
- implement stable evidence ordering;
- apply policy-over-FAQ precedence when relevant;
- return explicit no-answer or insufficient-evidence states.

**Expected file areas**

- `lib/knowledge/*`
- `tests/ph1-07/*`

**Acceptance**

- informational questions return stable evidence references when knowledge exists;
- weak or missing evidence produces safe fallback states.

### Stage 3 - Observability and PH1-08 handoff contract

**Goal**

Make retrieval traceable and ready for consumption by draft generation.

**Tasks**

- emit retrieval requested and completed events;
- normalize retrieval refs for downstream prompt use;
- document the handoff contract to PH1-08;
- ensure event payloads remain tenant-safe and compact.

**Expected file areas**

- `lib/knowledge/*`
- `lib/events/*`
- `.ai/specs/phase1/*`

**Acceptance**

- retrieval emits structured events with evidence summaries;
- PH1-08 can consume retrieval output without redefining result semantics.

### Stage 4 - Verification and retrieval smoke flow

**Goal**

Prove that published knowledge is retrievable and unpublished knowledge is ignored.

**Tasks**

- add helper checks for retrieval contracts;
- add live smoke verification against local published FAQ and policy data;
- verify no-answer behavior when only draft knowledge exists or evidence is missing;
- document manual verification notes for PH1-07.

**Expected file areas**

- `tests/ph1-07/*`
- `scripts/*`
- `LOCAL_SETUP.md`
- `.ai/specs/phase1/*`

**Acceptance**

- local verification demonstrates published-only retrieval and safe fallback behavior;
- PH1-08 handoff can rely on stable evidence refs and fallback states.

## Implementation Progress

Current status:
- Stage 2 deterministic ranking and precedence behavior completed on `feature/ph1-07-knowledge-retrieval`
- Next target: Stage 3 observability and PH1-08 handoff contract

Completed:
- [x] Defined PH1-07 product scope, retrieval rules, and handoff boundaries with PH1-08
- [x] Added typed retrieval contracts and normalized retrieval result helpers
- [x] Added published FAQ and policy candidate loaders scoped by `hotel_id`
- [x] Added `test:ph1-07` helper checks for retrieval candidate and fallback contracts
- [x] Added deterministic evidence ranking with explicit fallback states
- [x] Added policy-over-FAQ precedence in the ranking layer
- [x] Added `retrieveKnowledge(...)` helper that combines published candidate loading and ranking

Pending:
- [ ] Add retrieval observability and PH1-08 handoff contract wiring
- [ ] Add live smoke verification and manual PH1-07 retrieval notes

---

## Acceptance Criteria

This feature is complete only if:

1. retrieval reads only hotel-scoped knowledge for the current `hotel_id`;
2. unpublished FAQ and policy items are never returned as evidence;
3. published FAQ and policy items can be returned as normalized retrieval refs;
4. policy evidence takes precedence over FAQ evidence where both materially overlap;
5. retrieval returns explicit machine-readable no-answer states when evidence is weak or missing;
6. retrieval does not generate final draft text itself;
7. retrieval results are traceable through structured events;
8. downstream PH1-08 can consume evidence refs without redefining retrieval semantics;
9. local verification demonstrates published-only behavior and safe fallback behavior;
10. retrieval does not leak foreign-tenant knowledge or oversized raw payloads.

---

## Test Plan

### Unit tests

- published FAQ candidates load correctly for the current hotel;
- published policy candidates load correctly for the current hotel;
- draft knowledge is excluded from retrieval candidates;
- ranking returns stable ordering for a fixed query and knowledge set;
- policy precedence outranks FAQ where overlap exists;
- no-answer and insufficient-evidence states are returned deterministically.

### Integration tests

- a hotel-scoped guest message can retrieve published FAQ evidence;
- a hotel-scoped guest message can retrieve published policy evidence;
- foreign-tenant knowledge is never returned;
- unpublished knowledge remains invisible to retrieval even when text matches strongly;
- retrieval completion emits structured event data with evidence summaries.

### UI or downstream checks

- PH1-08-facing contracts can consume retrieval refs without extra shape conversion;
- evidence refs remain compact and suitable for prompt inputs or later display.

### Manual smoke verification

- create one published FAQ item and confirm retrieval can return it for a matching informational message;
- create one published policy item and confirm it can outrank FAQ evidence when both are relevant;
- unpublish one item and confirm retrieval no longer returns it;
- run a message with no relevant published knowledge and confirm retrieval returns clarification or escalation mode instead of confident evidence.

---

## Verification Commands

Core checks once implementation begins:

```bash
npm run typecheck
npm run test:ph1-06
npm run test:ph1-07
```

Smoke checks once a local flow is added:

```bash
npm run verify:ph1-07
```

Execution note:

- PH1-07 should be validated against real PH1-06 published knowledge records, not only synthetic ranking helpers;
- verification should explicitly show that draft or unpublished knowledge is ignored even when it textually matches the guest query.

---

## Dependencies for Next Features

This feature must be finished before:

- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow
- PH1-10 Observability, audit, and release acceptance

Those features may assume that published hotel knowledge can already be retrieved as a governed tenant-safe evidence layer.

---

## Open Assumptions Locked for This Spec

- Phase 1 retrieval is intentionally lightweight and does not require full semantic RAG infrastructure.
- PH1-07 returns evidence references and fallback state, not final guest-facing drafts.
- Policy evidence may outrank FAQ evidence when both are relevant to the same message.
- If reliable evidence is missing, the safe next action is clarification or escalation rather than confident factual drafting.
