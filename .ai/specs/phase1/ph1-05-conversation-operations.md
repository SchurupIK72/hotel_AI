# PH1-05 - Conversation Operations

> **Created:** 2026-04-17
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P1
> **Status:** Completed
> **Depends on:** PH1-04 - Conversation Workspace UI

---

## Summary

This feature turns the read-only conversation workspace into a minimally operable staff inbox.

It defines how hotel staff assign conversations, change workflow status, clear unread state through intended workspace behavior, and filter the inbox list by operational relevance.

Without this feature, PH1-04 lets staff inspect conversations, but it still does not support basic queue-handling behavior inside the inbox.

---

## Product Intent

Phase 1 staff need more than visibility. They need just enough control to manage incoming guest threads before broader automation and outbound flows are introduced.

This feature exists to add lightweight operational controls without introducing complex routing, SLA logic, or team-queue abstractions.

### Must-have outcomes

- hotel staff can change conversation workflow status inside the inbox;
- hotel staff can assign a conversation to a same-hotel staff user;
- unread state clears through an explicit and predictable workspace rule;
- the inbox can be filtered by `all`, `unread`, and `assigned_to_me`;
- filters stay consistent with status, assignment, and unread state changes.

### Out of scope

- SLA timers, routing rules, and escalation automation;
- per-user read receipts or per-user unread counters;
- multi-queue operations or advanced dispatching;
- real-time collaboration presence;
- outbound reply sending and AI draft selection;
- audit dashboards beyond the existing event-log model.

---

## Product Rules

### Operation scope rule

PH1-05 applies only to existing tenant-scoped `conversations` records produced by PH1-03 and rendered by PH1-04.

It must not invent a second operational record for status, assignment, or unread state.

### Access rule

The following hotel staff roles may operate on conversations in their own hotel:

- `hotel_admin`
- `manager`

No user may assign or update a conversation outside the resolved `hotel_id`.

### Status rule

Phase 1 operations support only these statuses:

- `new`
- `open`
- `pending`
- `closed`

The system must reject unsupported status values.

### Assignment rule

A conversation may be:

- unassigned (`assigned_hotel_user_id = null`);
- assigned to one active `hotel_user` from the same hotel.

The system must reject assignment to:

- inactive staff rows;
- users from another hotel;
- arbitrary unknown ids.

### Unread clearing rule

Phase 1 uses a conversation-level unread counter, not a per-user unread model.

When a staff user intentionally opens a conversation workspace in a way defined by the implementation, the system may clear `unread_count` to `0` for that conversation.

That rule must be:

- explicit;
- deterministic;
- consistent with inbox filters.

### Filter rule

The inbox must support exactly these Phase 1 filters:

- `all`
- `unread`
- `assigned_to_me`

The filter contract must remain stable for later inbox evolution.

### Consistency rule

After any valid operation, the workspace must keep these read-model fields consistent:

- `status`
- `assigned_hotel_user_id`
- `unread_count`
- filtered conversation membership in the inbox list

---

## Domain Scope

### Existing domain records consumed and updated by this feature

- `conversations`
- `hotel_users`

### Existing dependencies

- PH1-01 access guards and hotel-scoped staff identity
- PH1-03 normalized conversation persistence
- PH1-04 inbox read-model and workspace UI

### New domain persistence required by this feature

No new Phase 1 core tables are required for the base operations flow.

This feature may add operational events or lightweight helper functions, but it should reuse the existing `conversations` row as the source of truth.

### Downstream features that depend on this output

- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow
- PH1-10 Observability, audit, and release acceptance

---

## Data Model Requirements

### Existing table used as source of truth

`conversations`

Required mutable fields already exist:

- `status`
- `assigned_hotel_user_id`
- `unread_count`
- `updated_at`

### Assignment integrity requirement

If `assigned_hotel_user_id` is set, it must reference an active `hotel_users.id` from the same `hotel_id` as the conversation.

This may be enforced by application checks, database checks, or both, but foreign-tenant assignment must not be possible.

### Unread model constraint

Phase 1 keeps one shared unread counter per conversation.

This feature must not introduce per-user unread state without a dedicated follow-up spec and schema.

---

## Operation Contracts

### Status update contract

The backend should expose a trusted operation equivalent to:

```ts
type UpdateConversationStatusInput = {
  hotelId: string;
  conversationId: string;
  nextStatus: "new" | "open" | "pending" | "closed";
  actorHotelUserId: string;
};
```

Expected result:

- conversation status updated if valid;
- tenant boundary enforced;
- updated read model returned or revalidated.

### Assignment update contract

The backend should expose a trusted operation equivalent to:

```ts
type AssignConversationInput = {
  hotelId: string;
  conversationId: string;
  assignedHotelUserId: string | null;
  actorHotelUserId: string;
};
```

Expected behavior:

- assignment to active same-hotel staff succeeds;
- unassigning by setting `null` succeeds;
- invalid assignee or foreign tenant id fails safely.

### Unread clearing contract

The backend should expose an operation equivalent to:

```ts
type ClearConversationUnreadInput = {
  hotelId: string;
  conversationId: string;
  actorHotelUserId: string;
};
```

Expected behavior:

- `unread_count` becomes `0`;
- repeat calls remain safe and idempotent;
- inbox `unread` filter reflects the new state immediately or after revalidation.

### Filter contract

The workspace should accept a stable filter input equivalent to:

```ts
type InboxFilter = "all" | "unread" | "assigned_to_me";
```

Expected behavior:

- `all`: all conversations for the current hotel;
- `unread`: only conversations with `unread_count > 0`;
- `assigned_to_me`: only conversations where `assigned_hotel_user_id = currentHotelUserId`.

---

## UI Behavior

### Inbox filter behavior

The inbox list should present clearly selectable filter controls for:

- `all`
- `unread`
- `assigned_to_me`

The selected filter must remain visible and affect the conversation list predictably.

### Assignment UI behavior

The conversation workspace should expose an assignment control that:

- shows current assignment state;
- allows assignment to a same-hotel staff user;
- allows unassignment;
- communicates failure safely when the update is rejected.

### Status UI behavior

The conversation workspace should expose a status control that:

- shows the current status;
- allows switching to another valid Phase 1 status;
- re-renders the workspace with updated state after success.

### Unread clearing behavior

The workspace must define one explicit unread-clearing interaction path.

Acceptable examples include:

- automatic clear when the conversation detail page is opened;
- explicit "mark as read" action triggered by the staff user;
- equivalent deterministic server action tied to selecting the conversation.

The final implementation may choose the exact interaction, but the behavior must be stable and documented.

### Empty filter state

If the selected filter returns zero conversations, the inbox should show a filter-aware empty state instead of a generic failure state.

### Error behavior

If a conversation operation fails, the UI must:

- show a sanitized error message;
- keep tenant boundaries hidden;
- avoid leaving the page in a misleading partial-success state.

---

## Security and Tenant Safety

### Server-authoritative rule

All conversation operations must resolve authority from the server-side access context.

The client must not be trusted to declare:

- `hotel_id`
- assignee validity
- conversation ownership
- permission to mutate the record

### Same-hotel assignment rule

Assignment candidates must come from active `hotel_users` in the same hotel as the conversation.

### Hidden foreign-resource rule

If a user attempts to operate on a foreign-tenant conversation, the application should fail safely without revealing whether the record exists.

### Mutation auditability rule

Operational changes should be attributable through existing structured events or equivalent logging.

At minimum, the system should be able to distinguish:

- status changed;
- conversation assigned;
- conversation unassigned;
- unread cleared;
- invalid or unauthorized operation rejected.

---

## Application Interfaces

### Required backend helpers

Expected server-side helpers are likely to include:

- `updateConversationStatus(...)`
- `assignConversation(...)`
- `clearConversationUnread(...)`
- `listAssignableHotelUsers(...)`
- `listInboxConversations(hotelId, filter, currentHotelUserId?)`

The exact naming may vary, but the workspace must not duplicate operational logic across UI routes.

### Required frontend surfaces

Expected implementation areas are likely to include:

- `app/dashboard/inbox/*`
- `components/inbox/*`
- `lib/conversations/*`
- `lib/auth/*`
- optional server actions under `app/dashboard/inbox/*` or equivalent

### Read-model extension requirement

PH1-04 read-model helpers may be extended to include:

- active filter state;
- assignable staff options;
- operation result flashes or revalidation hooks.

Those extensions must preserve the existing PH1-04 workspace contract where practical.

---

## Implementation Plan

### Stage 1 - Trusted conversation mutation helpers

**Goal**

Add server-side operations for status, assignment, and unread clearing with tenant-safe checks.

**Tasks**

- implement status update helper;
- implement assignment and unassignment helper;
- implement unread-clearing helper;
- validate same-hotel active assignee rules;
- return or revalidate updated workspace state after mutation.

**Expected file areas**

- `lib/conversations/*`
- `lib/auth/*`
- `lib/events/*`

**Acceptance**

- invalid tenant or invalid assignee mutations fail safely;
- valid mutations update the conversation row consistently.

### Stage 2 - Inbox filter support

**Goal**

Allow staff to switch inbox views by operational relevance.

**Tasks**

- add `all`, `unread`, and `assigned_to_me` filter handling;
- update inbox data loader to support filter input;
- add filter controls to the inbox UI;
- add filter-aware empty states.

**Expected file areas**

- `app/dashboard/inbox/*`
- `components/inbox/*`
- `lib/conversations/*`

**Acceptance**

- each filter returns the expected conversation set;
- filter output stays in sync after supported operations.

### Stage 3 - Workspace controls for status and assignment

**Goal**

Expose the minimum staff controls inside the conversation workspace.

**Tasks**

- add status control UI;
- add assignment selector or equivalent control;
- show current assignee using same-hotel staff metadata rather than only raw ids where feasible;
- handle success and failure states safely.

**Expected file areas**

- `components/inbox/*`
- `app/dashboard/inbox/*`
- `lib/conversations/*`

**Acceptance**

- staff can assign, unassign, and change status from the workspace;
- the workspace reflects updated values without misleading stale state.

### Stage 4 - Unread behavior and verification

**Goal**

Make unread clearing behavior predictable and verifiable.

**Tasks**

- implement the chosen unread-clearing rule;
- ensure `unread` filter reflects the rule correctly;
- add helper checks and smoke verification for operations;
- document the operational verification flow.

**Expected file areas**

- `components/inbox/*`
- `lib/conversations/*`
- `tests/ph1-05/*`
- `scripts/*`
- `LOCAL_SETUP.md`

**Acceptance**

- unread state transitions are deterministic and idempotent;
- local verification can confirm assignment, status, unread clearing, and filter behavior.

## Implementation Progress

Current status:
- PH1-05 implementation completed on `feature/ph1-05-conversation-operations`
- Automated verification and browser-level local smoke have passed; feature is ready for merge flow

Completed:
- [x] Added Phase 1 status and inbox-filter contracts as shared workspace constants
- [x] Added tenant-safe server helpers for status update, assignment/unassignment, and unread clearing
- [x] Added active same-hotel assignable staff loaders
- [x] Added `test:ph1-05` helper checks and kept `typecheck` / `test:ph1-04` green
- [x] Added filter-aware inbox loading for `all`, `unread`, and `assigned_to_me`
- [x] Added filter UI controls and filter-aware empty states in the workspace
- [x] Added workspace status update control with server-side revalidation flow
- [x] Added assignment and unassignment control with same-hotel staff options
- [x] Added sanitized operation feedback and assignee name rendering in the workspace
- [x] Locked unread clearing to explicit conversation detail-route open and kept filters deterministic
- [x] Added `verify:ph1-05` live smoke verification and PH1-05 manual operation notes
- [x] Completed browser-level local smoke against authenticated inbox routes before merge

---

## Acceptance Criteria

This feature is complete only if:

1. hotel staff can change a conversation status within the Phase 1 status set;
2. hotel staff can assign and unassign conversations to active same-hotel staff users;
3. invalid assignee ids and foreign-tenant operations are rejected safely;
4. the inbox supports `all`, `unread`, and `assigned_to_me` filters;
5. filter results stay consistent after status, assignment, and unread-state changes;
6. unread state clearing follows one explicit and deterministic rule;
7. the workspace reflects updated conversation metadata after a successful operation;
8. the UI handles operation failures with sanitized feedback;
9. no new operation leaks tenant boundaries or secret data;
10. local verification can demonstrate the full operational flow on top of PH1-04.

---

## Test Plan

### Unit tests

- valid status transitions update `conversations.status`;
- invalid status values are rejected;
- assignment to same-hotel active staff succeeds;
- assignment to inactive or foreign-tenant staff is rejected;
- unread-clearing helper is idempotent;
- filter query logic returns correct rows for `all`, `unread`, and `assigned_to_me`.

### Integration tests

- authenticated hotel staff can change status from the inbox workspace;
- authenticated hotel staff can assign and unassign a conversation;
- unread count clears according to the chosen workspace rule;
- `assigned_to_me` filter updates after assignment;
- `unread` filter updates after unread clearing;
- foreign-tenant conversation mutation attempts fail safely.

### UI checks

- status control displays the current value and updated value after success;
- assignment control displays current assignment and supports unassignment;
- filter state is visibly selectable and stable across navigation;
- empty filter results show informative empty states rather than generic errors.

### Manual smoke verification

- after PH1-03 and PH1-04 data exists, a staff user can assign a conversation to themselves;
- a staff user can move the conversation between `new`, `open`, `pending`, and `closed`;
- unread-clearing behavior changes inbox filter membership as expected;
- `assigned_to_me` returns only conversations assigned to the current `hotel_user`.

---

## Verification Commands

Core checks once implementation begins:

```bash
npm run typecheck
npm run test:ph1-04
npm run test:ph1-05
```

Smoke checks once a local flow is added:

```bash
npm run verify:ph1-05
```

Execution note:

- PH1-05 should be validated on top of the PH1-04 workspace rather than through isolated mutation helpers only;
- smoke verification must confirm that filters and visible workspace state stay consistent after operations;
- the chosen unread rule for PH1-05 is: unread clears automatically when staff opens an explicit `/dashboard/inbox/[conversationId]` workspace route.

---

## Dependencies for Next Features

This feature must be finished before:

- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow
- PH1-10 Observability, audit, and release acceptance

Those features may assume that the inbox already supports the minimum human operational controls needed to manage a guest thread.

---

## Open Assumptions Locked for This Spec

- PH1-05 reuses the existing `conversations` schema and does not add a per-user unread model.
- Phase 1 assignment is limited to active same-hotel staff users.
- Both `hotel_admin` and `manager` may operate on conversations within their own hotel scope.
- Unread clearing may be automatic on open or explicit in the UI, but the final rule must be deterministic and documented.
