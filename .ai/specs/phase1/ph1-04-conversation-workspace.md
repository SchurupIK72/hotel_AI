# PH1-04 - Conversation Workspace UI

> **Created:** 2026-04-17
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** In Progress
> **Depends on:** PH1-01 - Tenant Foundation and Staff Access, PH1-03 - Inbound Messaging Ingestion

---

## Summary

This feature turns the protected dashboard shell into the first usable staff messaging workspace.

It defines how hotel staff browse tenant-scoped conversations, open one conversation safely, inspect guest context, read the message timeline, and see a reserved AI draft area from one screen.

Without this feature, PH1-03 can persist guest conversations correctly, but managers still cannot operate on that data in a practical daily workflow.

---

## Product Intent

Phase 1 needs a real inbox experience, not just stored messaging records.

This feature exists to make inbound Telegram conversations visible, understandable, and actionable for hotel staff before workflow controls and outbound reply actions are added in later specs.

### Must-have outcomes

- authenticated hotel staff can enter a dedicated inbox workspace from the protected dashboard;
- the workspace lists only conversations for the resolved `hotel_id`;
- staff can open one conversation and inspect guest details, message history, and read-only conversation metadata;
- the workspace exposes a stable UI region for AI draft review, even when no drafts exist yet;
- loading, empty, missing-data, and failure states are usable and tenant-safe.

### Out of scope

- changing conversation status, assignee, or unread state manually;
- sending guest replies or editing outbound reply drafts;
- generating AI drafts;
- real-time subscriptions, presence, or collaborative editing;
- omnichannel inbox abstractions;
- analytics or reporting dashboards.

---

## Product Rules

### Tenant-safe workspace rule

The workspace must resolve hotel scope from trusted server-side access helpers such as `requireHotelUser()`.

The UI must not trust client-supplied `hotel_id`, `guest_id`, or conversation ownership claims.

### Read-model rule

The inbox and conversation detail surfaces must read from normalized Phase 1 messaging records:

- `conversations`
- `messages`
- `guests`

The workspace must not depend on raw Telegram webhook payloads or event-log records for primary rendering.

### Default ordering rule

The inbox list must order conversations by most recent activity first using `last_message_at desc`.

The newest operationally relevant conversation must be the easiest one for staff to reach.

### Read-only workflow rule

In PH1-04, conversation workflow metadata may be displayed, but mutation controls are not yet part of scope.

The UI may show values such as:

- `status`
- `mode`
- `assigned_hotel_user_id`
- `unread_count`

But changing those values belongs to PH1-05 and later specs.

### Draft-area placeholder rule

The conversation workspace must reserve a visible draft panel or draft area even when draft generation has not been implemented yet.

Before PH1-08 exists, the draft area should communicate one of these safe states:

- no drafts available yet;
- draft generation is not ready for this conversation;
- draft loading failed safely.

### Safe data exposure rule

The workspace may show normalized guest and message data needed for staff operations, but it must not expose:

- Telegram webhook secret values;
- decrypted bot token data;
- raw secret-bearing headers;
- internal raw webhook payloads by default.

---

## Domain Scope

### Existing domain records consumed by this feature

- `conversations`
- `messages`
- `guests`
- `hotel_users`

### Existing dependencies

- PH1-01 access guards and tenant context resolution
- PH1-03 conversation, guest, and message persistence

### New domain persistence required by this feature

No new Phase 1 core tables are required for the base workspace UI.

This feature may introduce read-model helpers, query adapters, or optional server-side view helpers if needed for rendering performance and code clarity.

### Downstream features that depend on this output

- PH1-05 Conversation operations
- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow
- PH1-10 Observability, audit, and release acceptance

---

## Read Model Requirements

### Required inbox conversation list item

Each inbox row must provide enough context for staff to decide which conversation to open next.

Minimum fields:

- `conversation_id`
- `guest_id`
- `guest_display_name`
- `telegram_username` or equivalent guest handle when available
- `status`
- `mode`
- `last_message_preview`
- `last_message_at`
- `unread_count`
- `channel`

Optional supporting fields:

- `assigned_hotel_user_id`
- `last_inbound_message_at`
- `guest_language_code`

### Required conversation workspace payload

Opening one conversation must provide a server-trusted detail payload that includes:

- conversation metadata;
- guest summary data;
- ordered message timeline;
- draft-area view state;
- permission-safe fallback state when the conversation does not belong to the current hotel.

### Required guest summary fields

The guest summary card should display the best available normalized profile fields from `guests`:

- `display_name`
- `telegram_username`
- `first_name`
- `last_name`
- `language_code`
- `last_message_at`

The summary should remain useful even when some profile fields are null.

### Required timeline fields

Each message item in the timeline must provide:

- `message_id`
- `direction`
- `message_type`
- `text_body`
- `created_at`
- `delivered_at`
- `guest_id` where applicable

Phase 1 timeline rendering supports text messages only.

### Timeline ordering rule

The message timeline must render in chronological order so staff can read the conversation naturally from older messages to newer ones.

### Empty-detail behavior

If a conversation exists but contains no renderable messages, the workspace must show a safe empty-history state instead of breaking the layout.

---

## Routing and Navigation Contracts

### Required routes

The workspace should provide routes equivalent to:

- `/dashboard/inbox`
- `/dashboard/inbox/[conversationId]`

The exact route shape may vary if the final implementation preserves direct-linking, back-navigation, and tenant-safe resource checks.

### Navigation contract

Authenticated staff must be able to reach the inbox workspace without manually editing URLs.

Phase 1 should expose inbox access through one of:

- primary dashboard navigation;
- dashboard landing page entry point;
- a clearly visible workspace link inside the protected shell.

### Direct-link rule

If a staff member opens a direct conversation URL:

- the server must verify hotel ownership before rendering;
- a foreign-tenant conversation must not leak whether it exists;
- a missing conversation should show a safe not-found state.

---

## UI Behavior

### Inbox workspace layout

The staff workspace should combine these functional regions:

- conversation list;
- selected conversation detail;
- guest summary card;
- draft display area.

On narrower screens, the layout may stack or switch between list and detail views as long as the workspace remains usable on mobile and laptop widths.

### Inbox list behavior

The inbox list must let staff quickly scan:

- who the guest is;
- whether unread messages exist;
- when the latest activity happened;
- what the last message preview was;
- which conversation is currently selected.

### Selected conversation behavior

When a conversation is selected, the workspace should show:

- guest identity summary;
- read-only conversation metadata;
- message timeline;
- draft area state.

### Empty inbox state

If the hotel has no conversations yet, the inbox page must explain that no guest conversations are available and point the operator toward the Telegram ingestion prerequisite or setup path.

### Error state behavior

If inbox data cannot be loaded, the UI must show a sanitized error state with a safe retry path or operator guidance.

The error state must not reveal secrets, SQL details, or foreign-tenant identifiers.

### Loading state behavior

The workspace must provide loading states that preserve layout intent and make it obvious whether the list, detail view, or draft area is still resolving.

### Accessibility and readability rule

The workspace must keep message history readable for hotel staff under normal operational conditions:

- sufficient timestamp clarity;
- visual distinction between inbound and outbound messages;
- readable text wrapping for long guest messages;
- clear selected-row state in the inbox list.

---

## Security and Tenant Safety

### Access control rule

The workspace is available to authenticated hotel staff roles allowed by PH1-01:

- `hotel_admin`
- `manager`

### Server-side query rule

Workspace data loading must use the resolved access context and filter by the current `hotel_id`.

Server code must not fetch an arbitrary conversation by id without tenant scoping.

### Hidden foreign-resource rule

If a user requests a conversation outside their hotel scope, the application should return a safe `404` or equivalent not-found experience rather than leaking resource existence.

### Secret and payload hygiene

The UI must not render:

- `messages.raw_payload`
- webhook secret values
- bot token values
- internal event-log payloads unless a later internal-only admin feature explicitly adds that capability

---

## Application Interfaces

### Required backend read helpers

The backend should expose reusable read contracts equivalent to:

- `listInboxConversations(hotelId)`
- `getConversationWorkspace(hotelId, conversationId)`
- `listConversationMessages(hotelId, conversationId)`

The exact internal API may vary, but later features must be able to reuse the same trusted read path instead of duplicating query logic across pages.

### Required frontend surfaces

Expected implementation areas are likely to include:

- `app/dashboard/inbox/*`
- `components/inbox/*`
- `lib/conversations/*`
- `lib/messages/*`
- `lib/guests/*`

### Draft panel integration contract

The draft area should accept a stable view-state contract, for example:

```ts
type ConversationDraftPanelState =
  | { state: "not_available_yet" }
  | { state: "empty" }
  | { state: "ready"; drafts: Array<unknown> }
  | { state: "error"; message: string };
```

The exact shape may vary, but PH1-04 should establish a render boundary that PH1-08 can plug into later without redesigning the full workspace layout.

---

## Implementation Plan

### Stage 1 - Tenant-safe inbox read models

**Goal**

Define the server-side read path for the inbox list and one selected conversation workspace.

**Tasks**

- implement conversation list queries scoped by `hotel_id`;
- implement conversation detail queries scoped by `hotel_id` and `conversation_id`;
- join normalized guest summary data needed for UI rendering;
- define safe not-found and empty-state behavior;
- keep raw payload and secret-bearing fields out of client-facing models.

**Expected file areas**

- `lib/conversations/*`
- `lib/messages/*`
- `lib/guests/*`
- `lib/auth/*`

**Acceptance**

- staff-facing pages can load inbox and detail data through one trusted backend path;
- foreign-tenant conversations are not exposed through detail lookups.

### Stage 2 - Inbox route and navigation shell

**Goal**

Expose a first-class inbox page inside the protected dashboard.

**Tasks**

- add inbox route structure under `app/dashboard`;
- add visible navigation entry into the inbox workspace;
- render conversation list rows with preview, timestamp, and unread metadata;
- implement loading, empty, and error states for the inbox list;
- preserve mobile and desktop usability.

**Expected file areas**

- `app/dashboard/*`
- `app/dashboard/inbox/*`
- `components/inbox/*`
- `app/globals.css`

**Acceptance**

- hotel staff can reach the inbox through the protected UI;
- a hotel with stored conversations sees a usable ordered list.

### Stage 3 - Conversation detail workspace

**Goal**

Render the selected conversation as an operational workspace for staff review.

**Tasks**

- add guest summary card;
- add read-only conversation metadata panel;
- render chronological message timeline;
- handle null guest profile fields gracefully;
- add safe missing-conversation behavior for deep links.

**Expected file areas**

- `app/dashboard/inbox/[conversationId]/*`
- `components/inbox/*`
- `lib/conversations/*`
- `lib/messages/*`

**Acceptance**

- staff can open one conversation and understand guest context plus history from one screen;
- message history remains readable and tenant-safe.

### Stage 4 - Draft area boundary and verification

**Goal**

Reserve the workspace area that later AI draft and reply features will use, and make the current UI verifiable.

**Tasks**

- implement read-only draft panel states;
- show safe placeholder or empty state before PH1-08 is available;
- add helper checks for workspace read-model behavior;
- add local verification guidance for inbox UI with seeded or ingested conversations;
- document the expected manual verification flow.

**Expected file areas**

- `components/inbox/*`
- `tests/ph1-04/*`
- `scripts/*`
- `LOCAL_SETUP.md`

**Acceptance**

- the workspace layout already contains a stable draft area;
- PH1-08 can later attach draft data without restructuring the inbox screen.

---

## Acceptance Criteria

This feature is complete only if:

1. authenticated hotel staff can reach a dedicated inbox workspace from the protected dashboard;
2. the inbox shows only conversations belonging to the resolved `hotel_id`;
3. conversations are ordered by latest activity so recent guest activity appears first;
4. staff can open a conversation and view guest summary plus chronological message history;
5. the workspace displays read-only conversation metadata needed for operations;
6. the UI provides a stable draft display area even when no drafts exist yet;
7. empty, loading, not-found, and error states are handled gracefully;
8. foreign-tenant conversation ids do not reveal resource existence or data;
9. client-facing UI does not expose raw webhook payloads or channel secrets;
10. the workspace remains usable on both desktop and narrower mobile layouts.

---

## Test Plan

### Unit tests

- inbox read-model mapper returns preview, unread, and guest summary fields in the expected shape;
- conversation detail loader rejects foreign-tenant lookups safely;
- timeline ordering logic returns messages chronologically;
- draft panel state mapper handles `not_available_yet`, `empty`, and `error` states;
- empty guest profile fields degrade gracefully for rendering helpers.

### Integration tests

- authenticated hotel staff can open `/dashboard/inbox` and see only their hotel conversations;
- direct navigation to `/dashboard/inbox/[conversationId]` renders the correct conversation for the same hotel;
- foreign-tenant or unknown conversation ids return a safe not-found experience;
- a hotel with no conversations sees the empty inbox state;
- an ingested Phase 1 conversation renders guest summary and message timeline without exposing raw payload fields.

### UI checks

- selected conversation is visually distinguishable in the inbox list;
- unread count and last activity time are visible in list rows;
- inbound and outbound message bubbles or blocks are visually distinguishable;
- mobile layout remains usable without trapping the user away from either list or detail content.

### Manual smoke verification

- after PH1-03 ingestion creates at least one conversation, a staff user can sign in and open that conversation in the inbox UI;
- the guest name, last preview, and unread metadata align with stored conversation fields;
- the draft panel shows a safe placeholder state until PH1-08 is implemented.

## Implementation Progress

Current status:

- PH1-04 already has a working first-pass inbox workspace wired into the protected dashboard;
- all automated checks and local smoke verification now pass against the local Supabase stack;
- the main remaining work is broader browser-level validation;
- this feature now actively consumes the normalized messaging records produced by PH1-03.

- [x] tenant-safe inbox read-model helpers added for conversation list, conversation detail, and message timeline
- [x] inbox routes added at `/dashboard/inbox` and `/dashboard/inbox/[conversationId]`
- [x] protected dashboard navigation updated to expose the inbox workspace
- [x] default workspace behavior now opens the latest conversation automatically when available
- [x] guest summary card, timeline view, conversation metadata panel, and draft placeholder panel added
- [x] loading, error, empty, and safe not-found states added for the workspace routes
- [x] helper checks added via `npm run test:ph1-04`
- [x] local smoke verification script added via `npm run verify:ph1-04`
- [x] live local smoke verification completed successfully against a running local Supabase stack
- [ ] broader browser-level manual workspace verification completed end-to-end

---

## Verification Commands

Core checks:

```bash
npm run typecheck
npm run test:ph1-03
npm run test:ph1-04
```

Smoke checks:

```bash
npm run verify:ph1-04
```

Execution note:

- `npm run test:ph1-03` remains relevant because PH1-04 depends on the ingestion contracts established by PH1-03;
- `npm run verify:ph1-04` validates the workspace against real conversation records and requires a running local Supabase stack;
- the latest automated run completed successfully with `typecheck`, `test:ph1-03`, `test:ph1-04`, and `verify:ph1-04` all passing on the local environment.

---

## Dependencies for Next Features

This feature must be finished before:

- PH1-05 Conversation operations
- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow

Those features may assume that staff already have a stable tenant-safe inbox workspace and conversation detail surface.

---

## Open Assumptions Locked for This Spec

- PH1-03 already provides stable `conversations`, `messages`, and `guests` records for the inbox to read.
- Telegram is the only live messaging channel in Phase 1, so the workspace may optimize for that single channel without introducing omnichannel abstractions.
- PH1-04 is read-oriented; mutation controls for assignment, status changes, unread clearing, and reply send remain separate follow-up work.
- The draft area may ship initially as a placeholder state, but the layout boundary must be real and reusable.
