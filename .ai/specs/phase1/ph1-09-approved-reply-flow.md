# PH1-09 - Human-Approved Outbound Reply Flow

> **Created:** 2026-04-19
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** In Progress
> **Depends on:** PH1-02 - Hotel Setup and Telegram Integration, PH1-04 - Conversation Workspace UI, PH1-08 - AI Draft Generation

---

## Summary

This feature turns the existing inbox workspace into the final Phase 1 reply surface where a hotel staff user can choose an AI draft, edit the reply text, or write a manual response and then send that final message to the guest through Telegram.

It defines the explicit human approval boundary, the outbound delivery lifecycle, how sent replies are persisted into the normalized message timeline, and how draft-to-send traceability is preserved for later audit.

Without this feature, PH1-08 can generate helpful drafts, but Phase 1 still cannot deliver a manager-approved reply back to the guest.

---

## Product Intent

Phase 1 must remain a Copilot product, not an autonomous agent.

This feature exists to make the final outbound step operational while preserving one hard rule: no AI-produced text reaches the guest unless a human intentionally reviews and sends it.

### Must-have outcomes

- hotel staff can send a plain-text reply from the existing conversation workspace;
- staff can start from an AI draft or compose a manual reply from scratch;
- any selected draft can be edited before send, and the final sent text is the edited text actually reviewed by the human;
- successful outbound replies are persisted into the same tenant-scoped message timeline used by PH1-03 and PH1-04;
- the system preserves traceability from a sent outbound message back to `source_draft_id` when a draft was used;
- delivery failures are visible, sanitized, and safe to retry only when the outcome is known to be retryable.

### Out of scope

- automatic outbound sending;
- scheduled sends or follow-up reminders;
- multimedia outbound messages;
- buttons, inline keyboards, or other advanced Telegram message features;
- translation workflows, tone optimization, or autonomous escalation logic;
- omnichannel outbound abstractions beyond Telegram.

---

## Product Rules

### Explicit-human-send rule

No AI draft may be sent automatically.

The final send operation must require one explicit staff action from a protected server-authoritative workspace path.

### Final-text rule

The text sent to Telegram is always the final human-reviewed editor value, not the original stored draft text.

If a user selects an AI draft and edits it, the sent message must preserve:

- the final outbound text body;
- the `source_draft_id` of the originating draft;
- the identity of the staff user who initiated the send.

### Manual-reply parity rule

PH1-09 must support a manual reply path even when:

- no AI drafts exist;
- drafts were suppressed in PH1-08;
- the operator chooses not to use AI output.

Manual replies remain tenant-scoped and auditable even when `source_draft_id` is `null`.

### Tenant rule

Draft reads, composer actions, outbound sending, and outbound message persistence must remain scoped to the resolved `hotel_id`.

The client must never decide which hotel, integration, conversation, or draft is authoritative.

### Basic-text rule

Phase 1 outbound replies are plain Telegram text messages only.

The send surface must reject unsupported payload types and keep text within Telegram-safe limits for `sendMessage`.

### Delivery-lifecycle rule

The product must distinguish between:

- send accepted and persisted;
- retryable failure before delivery is confirmed;
- ambiguous failure where delivery outcome is unknown and blind retry would risk duplicate guest messages.

PH1-09 must prefer safe operator visibility over pretending delivery certainty.

### Draft-selection rule

If a draft is used, the system should preserve a machine-readable selection and sent-state trail that PH1-10 can audit later.

At minimum, one draft can move through these states:

- `generated`
- `selected`
- `sent`
- `discarded`

### Timeline-truth rule

The conversation timeline remains the operational source of truth for successfully delivered outbound guest communication.

Failed or ambiguous send attempts may be visible in workspace delivery UI or events, but PH1-09 must not fabricate a successful outbound timeline message unless Telegram accepted the send.

### No-hidden-send rule

Double-submit, page refresh, or action retry must not silently create duplicate outbound sends from one intentional human click path.

PH1-09 does not need global exactly-once delivery guarantees, but it must provide a retry-safe local workflow boundary.

---

## Domain Scope

### Existing domain records consumed by this feature

- `conversations`
- `messages`
- `guests`
- `hotel_users`
- `channel_integrations`
- `ai_drafts`
- `event_logs`

### Existing dependencies

- PH1-02 active Telegram integration lookup and shared `sendMessage` contract
- PH1-04 tenant-safe workspace routes and message timeline rendering
- PH1-05 conversation operations and existing protected inbox actions surface
- PH1-08 stored AI drafts and regenerate flow

### New domain persistence required by this feature

PH1-09 should keep `messages` as the durable normalized communication record for successful outbound replies, but it also needs a minimal outbound-delivery state model that can represent safe retry handling.

The preferred Phase 1 direction is:

- extend `messages` so outbound rows can carry delivery metadata and actor attribution;
- preserve `source_draft_id` on sent outbound rows;
- add only the minimum delivery-status metadata needed to distinguish `sending`, `sent`, `failed_retryable`, and `failed_ambiguous`.

If implementation pressure proves that extending `messages` cleanly is not feasible, a narrowly scoped outbound-attempt helper table is acceptable, but the operational truth for delivered replies must still land in `messages`.

### Downstream features that depend on this output

- PH1-10 Observability, audit, and release acceptance

---

## Data Model Requirements

### Outbound message persistence requirement

Successful outbound replies must be represented as first-class `messages` records with:

- `direction = 'outbound'`
- `message_type = 'text'`
- tenant-scoped `hotel_id`
- correct `conversation_id`
- correct `guest_id` when available
- correct `external_chat_id`
- final sent `text_body`
- `source_draft_id` set when a draft was used
- Telegram message identifier stored as the external delivery identifier
- `delivered_at` timestamp on success

### Actor attribution requirement

The system should preserve which hotel staff user initiated the send.

The preferred minimum schema direction is a field equivalent to:

- `sent_by_hotel_user_id uuid null references hotel_users(id)`

This should be filled for successful sends and any persisted failed send attempt record.

### Delivery status requirement

The outbound persistence model must support a status equivalent to:

```ts
type OutboundDeliveryStatus =
  | "sending"
  | "sent"
  | "failed_retryable"
  | "failed_ambiguous";
```

Expected meaning:

- `sending`: the trusted backend has accepted one send request and is actively resolving Telegram delivery;
- `sent`: Telegram accepted the outbound text and the timeline record is durable;
- `failed_retryable`: send failed before delivery was accepted and a safe retry may be offered;
- `failed_ambiguous`: delivery outcome is unknown, so the UI must avoid blind duplicate resend behavior.

### Draft status transition requirement

When a staff user chooses a draft in the workspace, PH1-09 should update `ai_drafts.status` in a deterministic way that later audit can inspect.

Expected minimum behavior:

- selecting one draft marks that row `selected`;
- selecting another draft in the same visible draft set removes the earlier `selected` state from the previously chosen row;
- successful send using a selected draft marks that draft `sent`;
- non-sent sibling drafts may remain `generated` unless the product explicitly chooses to mark them `discarded`.

### Retry-key requirement

The outbound send path needs one internal idempotency or operation key per explicit human send action.

The exact field name may vary, but the backend must be able to recognize repeated submissions of the same in-flight send request and avoid creating duplicate local send attempts.

### Message schema compatibility requirement

PH1-09 must preserve PH1-03 and PH1-04 read-model assumptions:

- inbound messages still render chronologically;
- outbound messages remain renderable in the same timeline model;
- `source_draft_id` continues to distinguish draft-backed vs manual replies;
- message persistence changes must not break existing inbox list previews or `last_message_at` updates.

---

## Outbound Reply Contracts

### Reply composer contract

The workspace should evolve from a read-only draft panel into a draft-plus-composer boundary equivalent to:

```ts
type ConversationReplyComposerState = {
  conversationId: string;
  selectedDraftId: string | null;
  editorValue: string;
  source: "manual" | "draft";
  sendState: "idle" | "sending" | "sent" | "failed_retryable" | "failed_ambiguous";
  canSend: boolean;
  errorMessage: string | null;
};
```

The exact UI state shape may vary, but PH1-09 must preserve a stable distinction between:

- draft review;
- reply editing;
- explicit send outcome feedback.

### Send reply request contract

The backend should expose one trusted operation equivalent to:

```ts
type SendConversationReplyInput = {
  hotelId: string;
  conversationId: string;
  replyText: string;
  selectedDraftId?: string | null;
  actorHotelUserId: string;
  operationKey: string;
};
```

Expected behavior:

- validate hotel-scoped staff authority;
- validate that the conversation belongs to the current hotel;
- validate that `selectedDraftId`, if present, belongs to the current conversation and hotel;
- resolve the active Telegram integration through PH1-02 server contracts;
- resolve the correct guest chat target from trusted conversation/message state;
- send plain text through the shared Telegram client helper;
- persist outbound result and revalidate the workspace.

### Send reply result contract

The backend should return a normalized result equivalent to:

```ts
type SendConversationReplyResult =
  | {
      outcome: "sent";
      messageId: string;
      conversationId: string;
      sourceDraftId: string | null;
      deliveredAt: string;
    }
  | {
      outcome: "failed";
      failureType: "retryable" | "ambiguous";
      message: string;
      persistedAttemptId?: string | null;
    };
```

Expected behavior:

- `sent` means Telegram accepted the outbound reply and the message timeline can show the new outbound text;
- `failed.retryable` means staff can try again without misleading duplicate-send risk;
- `failed.ambiguous` means the operator should verify guest delivery before retrying.

### Draft selection contract

The workspace should expose a trusted action equivalent to:

```ts
type SelectConversationDraftInput = {
  hotelId: string;
  conversationId: string;
  draftId: string;
  actorHotelUserId: string;
};
```

Expected behavior:

- only one selected draft is active in the visible draft set at a time;
- selecting a draft primes the reply editor with that draft text;
- manual edits after selection do not erase the `source_draft_id` trace.

### Retry contract

The workspace may expose a retry action only for a persisted failure classified as `failed_retryable`.

Expected behavior:

- retry reuses the same trusted conversation and integration checks;
- retry must not create duplicate local attempts for the same in-flight action;
- ambiguous failures must not offer a blind one-click resend path.

---

## UI Behavior

### Workspace composer behavior

The existing PH1-08 draft area should evolve into a reply work area that includes:

- latest draft cards when available;
- a clear "Use draft" action for each draft;
- an editable reply text area;
- a manual-reply path even when drafts are absent;
- a send button with visible sending state;
- sanitized success or failure feedback.

### Draft-to-editor behavior

Selecting a draft should copy that draft text into the editable reply field without sending it.

The UI must make it clear that:

- the draft is only a starting point;
- the operator can edit the text before send;
- nothing is sent until the explicit send action succeeds.

### Manual-reply behavior

If no drafts are available, the workspace should still show a usable reply editor with operator guidance such as:

- draft generation is unavailable for this conversation;
- you can still send a manual reply.

### Send guard behavior

The send button should stay disabled when:

- the editor is empty after trimming;
- a send request is already in flight for the same composer state;
- the conversation has no resolvable outbound Telegram target;
- the active Telegram integration is unavailable.

### Success behavior

After a successful send:

- the outbound message appears in the conversation timeline;
- the conversation preview and `last_message_at` reflect the new message;
- the editor clears or resets to a safe sent state;
- the workspace shows a compact success confirmation;
- the selected draft, if any, transitions to `sent`.

### Failure behavior

If send fails, the UI must:

- show a sanitized explanation;
- preserve the reply text so the operator does not lose reviewed content;
- distinguish retryable from ambiguous failures;
- avoid claiming the guest definitely received the reply when delivery is unknown.

### Mobile and desktop behavior

The reply composer must remain usable in the existing inbox workspace on both laptop and narrower mobile widths without hiding the send boundary or the timeline context.

---

## Delivery and Failure Semantics

### Integration-availability behavior

If the hotel has no active Telegram integration, PH1-09 must fail safely with an operator-visible message rather than attempting an outbound send.

### Conversation-target behavior

The outbound path must resolve the correct Telegram chat target from trusted conversation data, not from client-submitted chat identifiers.

### Retryable-failure behavior

Examples of retryable failure classes may include:

- local pre-send validation failure;
- Telegram rejection with a clear unsuccessful response;
- integration missing or inactive before send begins.

These failures may expose a retry path after the operator reviews the error.

### Ambiguous-failure behavior

Examples of ambiguous failure classes may include:

- network timeout after request dispatch where acceptance is unknown;
- unexpected response parsing failure after remote delivery may already have occurred;
- any condition where the system cannot prove the guest did not receive the message.

These failures must not default to an automatic retry recommendation.

### Event emission behavior

PH1-09 should emit structured events equivalent to:

- `conversation_draft_selected`
- `outbound_reply_send_requested`
- `outbound_reply_sent`
- `outbound_reply_failed`

The exact event names may vary, but later audit must be able to reconstruct:

- who selected a draft;
- who sent a reply;
- whether the reply was manual or draft-backed;
- whether delivery failed in a retryable or ambiguous way.

---

## Security and Tenant Safety

### Access control rule

The outbound reply flow is available only to the same staff roles already allowed in the inbox workspace:

- `hotel_admin`
- `manager`

PH1-09 should not introduce a new support-only send path for `super_admin` in Phase 1.

### Server-authoritative send rule

All outbound send operations must resolve authority, integration, conversation ownership, guest target, and draft ownership on the server.

The client must not be trusted to declare:

- `hotel_id`
- Telegram chat id
- integration id
- draft ownership
- send status

### Secret-handling rule

Bot tokens remain server-only and must never cross the client boundary through reply actions, logs, or error messages.

### Hidden foreign-resource rule

If a user attempts to send on a foreign-tenant conversation or with a foreign-tenant draft id, the application should fail safely without revealing whether that resource exists.

### Sanitized-error rule

UI-visible and log-visible errors must redact token-like strings and avoid exposing raw Telegram request payloads.

---

## Application Interfaces

### Required backend helpers

Expected server-side helpers are likely to include:

- `selectConversationDraft(...)`
- `sendConversationReply(...)`
- `retryConversationReply(...)`
- `resolveConversationOutboundTarget(...)`
- `persistOutboundMessage(...)`
- `classifyOutboundSendFailure(...)`

The exact naming may vary, but send orchestration should live in one trusted backend path rather than being split across route handlers and UI components.

### Required frontend surfaces

Expected implementation areas are likely to include:

- `app/dashboard/inbox/*`
- `components/inbox/*`
- `lib/conversations/*`
- `lib/copilot/*`
- `lib/telegram/*`

### Required verification surfaces

Expected implementation areas are likely to include:

- `tests/ph1-09/*`
- `scripts/verify-ph1-09-smoke.ts`
- `package.json`
- `LOCAL_SETUP.md`

---

## Implementation Plan

### Stage 1 - Outbound delivery data model and trusted send contracts

**Goal**

Define the outbound lifecycle shape and one trusted server contract for sending a reply from a hotel-scoped conversation.

**Tasks**

- extend outbound persistence to carry actor attribution and delivery status;
- preserve `source_draft_id` for draft-backed sends;
- define typed send input and result contracts;
- add failure classification helpers for retryable vs ambiguous outcomes;
- keep schema changes compatible with the existing timeline read model.

**Expected file areas**

- `supabase/migrations/*`
- `types/database.ts`
- `lib/conversations/*`
- `lib/telegram/*`
- `tests/ph1-09/*`

**Acceptance**

- the backend can represent one outbound send request and its final delivery outcome safely;
- successful sends fit into the normalized message timeline without redesigning PH1-04 readers.

### Stage 2 - Draft selection and reply-send orchestration

**Goal**

Turn visible draft cards plus manual input into one server-authoritative send path.

**Tasks**

- add trusted draft selection helper and status transitions;
- validate selected draft ownership against conversation and hotel scope;
- implement reply text validation for plain-text Telegram sends;
- resolve active Telegram integration and conversation chat target;
- send outbound text and persist success or classified failure outcome.

**Expected file areas**

- `lib/copilot/*`
- `lib/conversations/*`
- `lib/telegram/*`
- `app/dashboard/inbox/actions.ts`
- `tests/ph1-09/*`

**Acceptance**

- staff can send a manual reply or a draft-backed edited reply through one trusted path;
- foreign-tenant draft ids, missing integrations, and invalid conversations fail safely.

### Stage 3 - Workspace composer integration

**Goal**

Evolve the PH1-08 draft panel into the real human-approved reply workspace.

**Tasks**

- add "Use draft" affordances on draft cards;
- add editable reply composer UI and explicit send action;
- preserve the reply body on failure;
- show success, retryable failure, and ambiguous failure feedback;
- render successful outbound messages in the same timeline after revalidation.

**Expected file areas**

- `components/inbox/workspace.tsx`
- `app/dashboard/inbox/*`
- `lib/conversations/*`
- `app/globals.css`
- `tests/ph1-09/*`

**Acceptance**

- the inbox workspace clearly separates draft review from explicit sending;
- operators can complete the full human-reviewed reply flow without leaving the conversation screen.

### Stage 4 - Verification, failure safety, and PH1 release readiness

**Goal**

Prove the outbound approval boundary, draft traceability, and failure handling before PH1-10 broadens observability.

**Tasks**

- add helper checks for draft selection, manual reply, and `source_draft_id` persistence;
- add smoke verification with stubbed Telegram `sendMessage` success and failure paths;
- verify retryable and ambiguous failure mapping;
- verify no reply is sent without explicit action;
- document the manual local verification path for draft-backed and manual sends.

**Expected file areas**

- `tests/ph1-09/*`
- `scripts/verify-ph1-09-smoke.ts`
- `package.json`
- `LOCAL_SETUP.md`
- `.ai/specs/phase1/*`

**Acceptance**

- local verification proves that draft-backed and manual replies both work end-to-end;
- failure states are operator-safe and do not collapse into silent duplicate-send risk.

---

## Acceptance Criteria

This feature is complete only if:

1. a hotel staff user can send a plain-text guest reply from the protected conversation workspace;
2. the system supports both draft-backed replies and manual replies with no draft selected;
3. no AI draft is sent without an explicit human send action;
4. selecting a draft does not send it and preserves `source_draft_id` traceability if later used;
5. successful outbound sends are persisted as tenant-scoped outbound timeline messages;
6. successful draft-backed sends link the final message to the originating `source_draft_id`;
7. missing integrations, invalid draft ids, and foreign-tenant resources fail safely;
8. send failures are classified as retryable or ambiguous and shown with sanitized feedback;
9. repeated submission of the same in-flight send action does not create uncontrolled duplicate local attempts;
10. the workspace remains usable on desktop and narrower mobile widths through the full reply flow.

---

## Test Plan

### Unit tests

- draft selection updates only the chosen draft to `selected`;
- sending with `selectedDraftId = null` preserves manual-reply behavior;
- send helper rejects foreign-tenant conversation ids and foreign-tenant draft ids safely;
- outbound failure classifier maps retryable vs ambiguous cases deterministically;
- outbound success persistence keeps `source_draft_id`, actor attribution, and timeline fields aligned.

### Integration tests

- authenticated staff can select a draft, edit it, and send the final text;
- authenticated staff can send a manual reply when no drafts exist;
- successful send revalidates the workspace and shows the new outbound message;
- missing or inactive Telegram integration blocks send with a safe error;
- duplicate submit for one in-flight operation key does not create duplicate local send attempts.

### UI checks

- "Use draft" clearly populates the reply editor without sending;
- send button reflects sending state and disables repeated submission;
- success feedback is distinct from retryable failure and ambiguous failure feedback;
- the reply text remains visible after a failed send;
- mobile layout keeps the reply editor and send action reachable.

### Manual smoke verification

- open a conversation with PH1-08 drafts, choose one draft, edit wording, and send it successfully;
- open a conversation with suppressed or absent drafts and send a manual reply;
- simulate a retryable Telegram failure and confirm the editor preserves content plus safe retry messaging;
- simulate an ambiguous failure and confirm the UI avoids a blind resend recommendation;
- confirm the successful outbound message appears in the timeline with the correct final text.

---

## Verification Commands

Core checks once implementation begins:

- `npm.cmd run typecheck`
- `npm.cmd run test:ph1-08`
- `npm.cmd run test:ph1-09`

Smoke checks once a local flow is added:

- `npm.cmd run verify:ph1-09`

Execution note:

- `verify:ph1-09` should stub Telegram `sendMessage` locally so the end-to-end persistence and workspace flow can be validated without relying on live network access;
- verification must cover both a draft-backed send and a manual reply path, plus retryable and ambiguous failure outcomes.

---

## Dependencies and Handoffs

### Dependency on PH1-02

PH1-09 must reuse the shared Telegram integration and secret-resolution contracts from PH1-02.

It must not invent a second outbound client path.

### Dependency on PH1-08

PH1-08 ends when drafts are generated, stored, and rendered.

PH1-09 begins when a human chooses whether to:

- use one draft;
- edit that draft;
- send a manual reply instead;
- or not send anything yet.

### Handoff to PH1-10

PH1-09 should emit enough structured state for PH1-10 to audit:

- draft selection;
- send initiation;
- send success;
- send failure classification;
- draft-backed vs manual final reply usage.

---

## Open Assumptions Locked for This Spec

- Telegram remains the only live outbound channel in Phase 1.
- Phase 1 outbound replies are plain text only.
- `hotel_admin` and `manager` may both send replies inside their own hotel scope.
- The final sent reply always comes from a human-reviewed editor state, even when a draft seeded that text.
- Ambiguous delivery outcomes should block blind retry by default.
