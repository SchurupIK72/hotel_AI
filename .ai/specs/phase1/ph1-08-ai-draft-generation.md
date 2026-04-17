# PH1-08 - AI Draft Generation

> **Created:** 2026-04-17
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** In Progress
> **Depends on:** PH1-03 - Inbound Messaging Ingestion, PH1-04 - Conversation Workspace, PH1-07 - Knowledge Retrieval

---

## Summary

This feature creates the first end-to-end Copilot generation layer that turns one inbound guest message plus trusted hotel context into 1-3 suggested reply drafts.

It defines when draft generation is allowed, how retrieval evidence is passed into generation, how generated drafts are stored, and how the inbox workspace renders draft results without crossing the human-approval safety boundary.

Without this feature, PH1-04 only shows a placeholder draft area and PH1-09 has no structured drafts to review or send.

---

## Product Intent

Phase 1 needs useful Copilot assistance, but it also needs a narrow safety boundary.

The goal is to generate helpful draft replies for supported informational guest questions while refusing to fabricate transactional, sensitive, or weakly supported answers.

### Must-have outcomes

- supported informational guest messages can produce 1-3 stored reply drafts;
- draft generation consumes normalized PH1-07 retrieval output instead of querying knowledge ad hoc;
- draft text is visible inside the existing PH1-04 workspace draft area;
- missing or weak evidence leads to safe clarify-or-escalate behavior;
- generated drafts are stored with enough metadata for PH1-09 selection and PH1-10 auditability.

### Out of scope

- automatic outbound sending;
- final human selection or edit-before-send UX;
- live booking, pricing, refund, or availability tool calls;
- autonomous complaint handling or compensation decisions;
- multilingual optimization beyond whatever the base model can already support safely;
- production analytics, A/B testing, or model experimentation infrastructure.

---

## Product Rules

### Suggestion-only rule

AI drafts are staff suggestions only.

No draft may be sent to the guest automatically in PH1-08.

### Supported-use-case rule

PH1-08 is intended for informational guest questions that can be answered from:

- conversation context;
- approved hotel knowledge retrieved by PH1-07;
- or safe clarification wording when strong evidence is unavailable.

### Unsupported-request rule

The generator must not produce confident factual drafts for:

- live availability;
- live pricing;
- booking modification or cancellation promises;
- refunds, compensation, or complaint resolution promises;
- VIP exceptions or policy overrides;
- any request that requires human judgment or live system access.

For these cases, the system should either suppress drafts or generate cautious handoff wording, depending on the downstream contract chosen for the workspace.

### Evidence-first rule

If PH1-07 returns `evidence_found`, the generator should prefer evidence-backed wording over freeform model recall.

If PH1-07 returns `insufficient_evidence` or `no_relevant_evidence`, the generator must not silently invent policy or operational facts.

### Bounded-output rule

Each generation run should return:

- 1-3 drafts when generation is allowed;
- or an explicit no-draft / suppressed state when generation is not allowed.

The system must not create an unbounded number of drafts per message.

### Regeneration rule

Managers may explicitly refresh drafts for a conversation, but regeneration must create a new generation result tied to the current inbound message context rather than mutating the historical text of earlier drafts invisibly.

### Latest-inbound rule

Draft generation in Phase 1 should target the latest relevant inbound guest message for the active conversation.

It should not accidentally generate drafts for an older guest message when a newer inbound message exists.

### Tenant rule

All draft generation, retrieval usage, and draft reads must remain scoped to the resolved `hotel_id`.

No cross-hotel context, evidence, or stored draft rows may be exposed.

### Human-handoff rule

When the request is unsupported or risky, the product should favor:

- no draft;
- a cautious clarification draft;
- or explicit escalation wording suitable for human review.

The generator must not create language that looks like a committed hotel action when staff approval is still pending.

---

## Domain Scope

### Existing domain records consumed by this feature

- `conversations`
- `messages`
- `guests`
- `faq_items`
- `policy_items`
- `event_logs`

### Existing dependencies

- PH1-03 inbound message persistence and latest-message grounding
- PH1-04 workspace draft panel boundary
- PH1-05 operational conversation controls
- PH1-06 curated knowledge management
- PH1-07 tenant-safe retrieval and evidence contracts

### New domain persistence required by this feature

This feature should introduce `ai_drafts` persistence and any minimal conversation metadata needed to track latest draft generation.

Expected minimum persistence direction:

- `ai_drafts`
- optional `conversations.last_ai_draft_at` if helpful for sorting or UI freshness

### Downstream features that depend on this output

- PH1-09 Human-approved outbound reply flow
- PH1-10 Observability, audit, and release acceptance

---

## Data Model Requirements

### AI draft record requirement

Generated drafts must be stored as first-class records, not ephemeral prompt output.

Expected minimum fields are equivalent to:

- `id`
- `hotel_id`
- `conversation_id`
- `message_id`
- `draft_index`
- `draft_text`
- `source_type`
- `status`
- `retrieval_refs`
- `model_name`
- `confidence_label`
- `created_at`

### Draft status requirement

Phase 1 draft records should support later PH1-09 transitions without redesigning the table shape.

At minimum, the persisted status model should support:

- `generated`
- `selected`
- `sent`
- `discarded`

PH1-08 only needs to create `generated` drafts, but it should not block the later workflow.

### Generation metadata requirement

Each draft set should preserve enough metadata for staff inspection and later auditability.

At minimum, generation output should preserve:

- triggering `message_id`
- `hotel_id`
- `conversation_id`
- retrieval result status
- evidence refs or evidence summary when used
- model identifier
- confidence label or generation rationale label

### Workspace state requirement

The existing PH1-04 draft panel should evolve from placeholder-only to a machine-readable state contract such as:

```ts
type ConversationDraftPanelState =
  | { state: "empty"; canGenerate: boolean }
  | { state: "generating" }
  | { state: "suppressed"; reason: "unsupported_request" | "insufficient_evidence" | "generation_failed" }
  | {
      state: "ready";
      messageId: string;
      retrievalStatus: "evidence_found" | "insufficient_evidence" | "no_relevant_evidence";
      drafts: Array<{
        id: string;
        draftIndex: number;
        draftText: string;
        sourceType: "kb" | "fallback" | "manual_trigger";
        confidenceLabel: string | null;
      }>;
    }
  | { state: "error"; message: string };
```

The exact shape may vary, but PH1-08 must plug into the existing workspace boundary rather than redesign the inbox layout.

---

## Draft Generation Contracts

### Draft generation request contract

The backend should expose a trusted generation operation equivalent to:

```ts
type GenerateConversationDraftsInput = {
  hotelId: string;
  conversationId: string;
  triggerMessageId: string;
  requestedByHotelUserId?: string | null;
  trigger: "auto_on_inbound" | "manual_regenerate";
};
```

Expected behavior:

- request runs only in the current hotel scope;
- `triggerMessageId` must belong to the same hotel-scoped conversation;
- generation loads latest trusted conversation context before calling the model;
- manual regeneration reuses the same trusted path as automatic generation.

### Draft generation result contract

The backend should return a normalized result equivalent to:

```ts
type GenerateConversationDraftsResult =
  | {
      outcome: "generated";
      retrievalStatus: "evidence_found" | "insufficient_evidence" | "no_relevant_evidence";
      drafts: Array<{
        id: string;
        draftIndex: number;
        draftText: string;
        sourceType: "kb" | "fallback" | "manual_trigger";
        confidenceLabel: string | null;
      }>;
    }
  | {
      outcome: "suppressed";
      reason:
        | "unsupported_request"
        | "insufficient_evidence"
        | "human_handoff_mode"
        | "generation_failed";
      retrievalStatus: "evidence_found" | "insufficient_evidence" | "no_relevant_evidence" | null;
    };
```

Expected behavior:

- `generated` means 1-3 drafts were persisted and are ready for review;
- `suppressed` means the system intentionally produced no staff draft set;
- generation failures should degrade to safe suppressed or error states rather than crash the workspace.

### Regenerate action contract

The workspace should expose a server action or equivalent route for:

`POST /api/conversations/:id/drafts/regenerate`

Expected behavior:

- validates hotel scope and authenticated staff membership;
- loads latest eligible inbound context;
- invokes PH1-07 retrieval;
- stores a new generated draft set or returns a safe suppressed state;
- refreshes the workspace without sending any outbound message.

---

## Generation Behavior

### Message eligibility behavior

Generation should run only for the latest relevant inbound guest message in the conversation.

Outbound staff messages must never be treated as generation triggers.

### Lightweight intent-gating behavior

Before generating drafts, PH1-08 should apply a minimal gating step that separates:

- supported informational requests;
- unsupported transactional or sensitive requests;
- clearly ambiguous requests that should produce clarification wording only.

This gating may be heuristic or model-assisted, but the product requirement is stable behavior, not a specific implementation technique.

### Retrieval handoff behavior

Generation should consume the PH1-07 retrieval contract directly.

Expected behaviors:

- `evidence_found` may support knowledge-backed drafts;
- `insufficient_evidence` should bias toward cautious clarification or suppression;
- `no_relevant_evidence` should not yield invented operational facts.

### Draft count behavior

When generation is allowed, the system should produce up to 3 alternatives with meaningful variation, such as:

- more concise wording;
- warmer tone;
- more explicit clarification phrasing.

The system should avoid storing near-duplicate drafts that differ only trivially.

### Source typing behavior

Stored drafts should indicate whether they primarily came from:

- retrieved knowledge (`kb`);
- safe fallback wording (`fallback`);
- manual regenerate trigger with the same safe generation path (`manual_trigger`).

The exact enum values may vary, but the stored source classification should stay machine-readable.

### Confidence labeling behavior

Drafts should carry a compact confidence or rationale label suitable for workspace display, for example:

- `knowledge-backed`
- `clarification-needed`
- `human-review`

The exact wording may vary, but the label should help staff quickly assess whether a draft is safe to consider.

### Workspace rendering behavior

The draft panel should:

- show ready drafts when generation succeeds;
- show a safe empty or suppressed state when drafts are not produced;
- expose a regenerate affordance for staff in the protected dashboard;
- avoid blocking the rest of the conversation workspace if generation fails.

### Idempotency and duplicate-trigger behavior

Duplicate inbound processing must not create uncontrolled duplicate draft sets for the same source message.

Phase 1 may satisfy this either by:

- only auto-generating once per inbound message;
- or marking repeated auto-trigger attempts as no-ops unless explicitly regenerated by staff.

The exact internal mechanism may vary, but duplicate webhook deliveries must not explode draft volume.

---

## Safety and Governance Rules

### No-fabrication rule

The generator must not invent:

- room inventory;
- pricing;
- booking confirmation data;
- unauthorized policy exceptions;
- promised compensation outcomes.

### Safe wording rule

When safe factual grounding is weak, the system should prefer wording such as:

- asking a clarifying question;
- offering to check with hotel staff;
- saying the manager should review before a final answer is sent.

### Prompt hygiene rule

Prompt construction must avoid leaking:

- tenant-foreign data;
- raw secrets;
- unnecessary raw payload blobs.

Only the minimum conversation and evidence context required for safe generation should be included.

### Logging hygiene rule

Event logs should preserve compact generation metadata and evidence summaries, not raw prompt bodies unless the project explicitly decides to store them later.

### Human-mode respect rule

If the conversation is already in `human_handoff_mode`, auto-generation should be suppressible by policy instead of insisting on draft creation.

---

## Application Interfaces

### Required backend helpers

Expected server-side helpers are likely to include:

- `generateConversationDrafts(...)`
- `maybeAutoGenerateDraftsForMessage(...)`
- `regenerateConversationDrafts(...)`
- `listLatestConversationDrafts(...)`
- `buildConversationDraftPanelState(...)`

The exact naming may vary, but generation orchestration should not be duplicated across API routes and workspace loaders.

### Required frontend surfaces

Expected implementation areas are likely to include:

- `app/dashboard/inbox/*`
- `components/inbox/*`
- `lib/conversations/*`
- `lib/copilot/*` or `lib/ai/*`
- `lib/knowledge/*`

### Required integration surfaces

Expected implementation areas are likely to include:

- `app/api/*` or server actions under `app/dashboard/inbox/*`
- `lib/events/*`
- `scripts/*`
- `tests/ph1-08/*`

---

## Implementation Plan

### Stage 1 - AI draft persistence and generation contracts

**Goal**

Define the durable `ai_drafts` data model and trusted server-side generation contracts.

**Tasks**

- add `ai_drafts` persistence and any minimal supporting conversation metadata;
- add typed generation input and result contracts;
- add latest-draft read helpers for one conversation;
- keep all writes scoped by `hotel_id`, `conversation_id`, and `message_id`;
- prepare deterministic draft panel state mapping for the workspace.

**Expected file areas**

- `supabase/migrations/*`
- `types/*`
- `lib/conversations/*`
- `lib/copilot/*` or `lib/ai/*`
- `tests/ph1-08/*`

**Acceptance**

- generated drafts can be stored and read back as hotel-scoped conversation data;
- the workspace can distinguish `empty`, `ready`, `suppressed`, and `error` draft states.

### Stage 2 - Generation orchestration and safety gating

**Goal**

Turn eligible inbound messages plus PH1-07 retrieval output into safe stored draft results.

**Tasks**

- implement latest-message eligibility checks;
- implement lightweight supported-vs-unsupported request gating;
- call PH1-07 retrieval and feed its result into generation;
- generate 1-3 drafts or a safe suppressed state;
- prevent duplicate auto-generation for repeated webhook deliveries.

**Expected file areas**

- `lib/copilot/*` or `lib/ai/*`
- `lib/knowledge/*`
- `lib/conversations/*`
- `tests/ph1-08/*`

**Acceptance**

- supported informational requests produce bounded stored drafts;
- unsupported or weakly grounded requests do not produce unsafe factual output.

### Stage 3 - Inbox workspace integration and regenerate flow

**Goal**

Render real draft results in the existing PH1-04 workspace and allow staff-triggered regeneration.

**Tasks**

- replace placeholder draft panel state with real PH1-08 data;
- show draft text, confidence labels, and retrieval-backed metadata;
- add a regenerate action in the workspace;
- preserve graceful loading, empty, suppressed, and error states;
- keep PH1-09 responsibilities out of scope by not adding send behavior here.

**Expected file areas**

- `app/dashboard/inbox/*`
- `components/inbox/*`
- `app/globals.css`
- `tests/ph1-08/*`

**Acceptance**

- hotel staff can see draft results in the conversation workspace;
- manual regenerate refreshes drafts without sending anything to the guest.

### Stage 4 - Verification and handoff to PH1-09

**Goal**

Prove that draft generation is safe, stored, and visible to staff before outbound approval is added.

**Tasks**

- add helper checks for draft contracts and state mapping;
- add live smoke verification against local Supabase and seeded knowledge;
- verify supported informational messages create drafts;
- verify unsupported or weak-evidence requests suppress or safely downgrade generation;
- document manual workspace verification notes for PH1-08.

**Expected file areas**

- `tests/ph1-08/*`
- `scripts/*`
- `LOCAL_SETUP.md`
- `.ai/specs/phase1/*`

**Acceptance**

- local verification proves draft generation works from inbound message through stored workspace rendering;
- PH1-09 can consume stable `ai_drafts` records without redefining draft semantics.

---

## Implementation Progress

Current status:
- Stage 2 generation orchestration and safety gating completed on `feature/ph1-08-ai-draft-generation`
- Ready for Stage 3 inbox workspace integration and regenerate flow

Completed:
- [x] Defined PH1-08 product scope, safety rules, and boundaries with PH1-09
- [x] Defined durable `ai_drafts` persistence direction and workspace state expectations
- [x] Defined generation, suppression, and regenerate contracts
- [x] Defined staged implementation and verification plan
- [x] Added `ai_drafts` schema and typed database surface for persistent AI draft records
- [x] Added `lib/copilot/*` Stage 1 models and latest-draft read helpers
- [x] Wired the PH1-04 workspace draft panel to stored `empty` / `ready` / `error` states
- [x] Added `test:ph1-08` helper checks for draft-generation persistence contracts
- [x] Added generation orchestration that combines latest-message checks, PH1-07 retrieval, and safe draft result shaping
- [x] Added lightweight safety gating for unsupported transactional or sensitive requests
- [x] Added automatic draft generation trigger after new inbound message persistence
- [x] Added duplicate auto-generation protection by reusing latest drafts for the same source message

Pending implementation:
- [ ] Stage 3 - Inbox workspace integration and regenerate flow
- [ ] Stage 4 - Verification and handoff to PH1-09

---

## Acceptance Criteria

This feature is complete only if:

1. the system can generate and persist 1-3 drafts for supported informational inbound messages;
2. draft generation is scoped to the correct `hotel_id`, conversation, and triggering inbound message;
3. PH1-07 retrieval output is reused directly instead of duplicated ad hoc knowledge lookup;
4. weak or missing evidence does not produce unsafe confident factual drafts;
5. unsupported transactional or sensitive requests are suppressed or downgraded to safe clarification/handoff behavior;
6. duplicate auto-triggering does not create uncontrolled duplicate draft sets for one inbound message;
7. the conversation workspace renders real draft states inside the existing PH1-04 draft area;
8. staff can manually regenerate drafts from the workspace without sending a message;
9. generated drafts store compact metadata needed for PH1-09 selection and PH1-10 audit trails;
10. generation failure does not break the rest of the inbox workspace or leak tenant-foreign information.

---

## Test Plan

### Unit tests

- draft-state mapper returns `empty`, `ready`, `suppressed`, and `error` variants correctly;
- latest-message eligibility helper ignores outbound messages and stale inbound messages;
- generation gating marks transactional or sensitive requests as suppressed;
- evidence-backed generation helpers preserve retrieval refs and confidence labels;
- duplicate auto-generation prevention behaves deterministically for one source message.

### Integration tests

- authenticated staff can open a conversation with generated drafts in the workspace;
- manual regenerate refreshes the latest draft set for the current conversation;
- foreign-tenant conversation ids cannot read or generate drafts;
- suppressed conversations show a safe workspace state instead of crashing.

### Manual smoke tests

- create or ingest an informational guest message with matching published knowledge and confirm 1-3 drafts appear;
- trigger a weak-evidence or unsupported request and confirm the panel shows safe suppressed or clarification-oriented behavior;
- use regenerate in the workspace and confirm new draft results appear without outbound send side effects;
- confirm the rest of the inbox timeline and guest context stay usable if generation fails.

---

## Verification Commands

Core checks:

- `npm.cmd run typecheck`
- `npm.cmd run test:ph1-07`
- `npm.cmd run test:ph1-08`

Smoke checks:

- `npm.cmd run verify:ph1-08`

Execution note:

- PH1-08 should be validated against real PH1-03 conversation/message data and PH1-07 retrieval results, not only isolated generation helpers;
- verification should explicitly show both successful informational draft generation and safe suppression behavior for unsupported or weak-evidence cases.

---

## Dependencies and Handoffs

### Dependency on PH1-07

PH1-08 consumes PH1-07 as the evidence layer.

PH1-08 must not redefine retrieval statuses or rebuild retrieval logic inside prompt orchestration.

### Boundary with PH1-09

PH1-08 ends when drafts are generated, persisted, and rendered for staff review.

PH1-09 begins when a human:

- selects a draft;
- edits reply text;
- sends the final outbound message;
- and ties the final sent message back to `source_draft_id`.

### Boundary with PH1-10

PH1-08 should emit enough metadata to make later audit and release checks straightforward, but PH1-10 owns the broader operational observability story.

---

## Notes

- The exact model provider, prompt template versioning scheme, and orchestration internals may evolve.
- The product requirement is a safe, tenant-scoped, evidence-aware draft generation capability rather than one specific SDK or prompt layout.
