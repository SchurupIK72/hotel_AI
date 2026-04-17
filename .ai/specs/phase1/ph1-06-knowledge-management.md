# PH1-06 - Knowledge Base Management

> **Created:** 2026-04-17
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** In Progress
> **Depends on:** PH1-01 - Tenant Foundation

---

## Summary

This feature creates the smallest usable hotel knowledge management surface that staff can curate before AI retrieval and draft generation are introduced.

It defines how hotel admins create, edit, publish, unpublish, and delete approved FAQ and policy content inside the protected dashboard.

Without this feature, later Copilot phases would have no tenant-safe source of approved hotel information and would be forced to rely on freeform prompts or hardcoded text.

---

## Product Intent

Phase 1 needs a minimal but governed knowledge base, not a full CMS.

The goal is to give each hotel one place to maintain approved answers and policies that later AI features can trust.

### Must-have outcomes

- hotel admins can manage FAQ items;
- hotel admins can manage policy items;
- every knowledge item stays scoped to one `hotel_id`;
- publish state clearly controls whether an item is eligible for later AI assistance;
- authorship and last editor attribution are preserved for operational accountability.

### Out of scope

- document upload or file parsing;
- embeddings, vector search, and semantic ranking;
- external sync from Google Docs, Notion, or PMS systems;
- role-based editorial workflows beyond the existing hotel admin guard;
- version history, review queues, or rollback UI.

---

## Product Rules

### Scope rule

PH1-06 manages only two Phase 1 knowledge types:

- FAQ items
- policy items

It must not attempt to become a generalized document platform in this iteration.

### Access rule

Only `hotel_admin` users may create, edit, delete, publish, or unpublish knowledge content for their own hotel.

`manager` users are not knowledge editors in Phase 1.

### Publish eligibility rule

Only published knowledge may be treated as approved knowledge for later AI retrieval.

Draft or unpublished items must remain invisible to downstream Copilot retrieval flows.

### Attribution rule

Each knowledge record must preserve:

- creator attribution;
- last editor attribution;
- publish state;
- creation and update timestamps.

### Tenant rule

No knowledge action may read or mutate records outside the resolved `hotel_id`.

### Minimal authoring rule

Phase 1 uses plain structured text inputs, not rich collaborative editing.

The feature should favor reliable CRUD over formatting complexity.

---

## Domain Scope

### Existing domain records consumed by this feature

- `hotels`
- `hotel_users`

### Existing dependencies

- PH1-01 tenant-safe auth, guards, and hotel membership
- protected dashboard shell and navigation
- existing event log helper for operational auditability

### New domain persistence required by this feature

This feature requires new hotel-scoped knowledge tables for:

- FAQ items
- policy items

### Downstream features that depend on this output

- PH1-07 Knowledge retrieval for Copilot
- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow

---

## Data Model Requirements

### FAQ knowledge record requirement

FAQ storage should support at minimum:

- `id`
- `hotel_id`
- `question`
- `answer`
- `is_published`
- `published_at`
- `created_by_hotel_user_id`
- `updated_by_hotel_user_id`
- `created_at`
- `updated_at`

### Policy knowledge record requirement

Policy storage should support at minimum:

- `id`
- `hotel_id`
- `title`
- `body`
- `is_published`
- `published_at`
- `created_by_hotel_user_id`
- `updated_by_hotel_user_id`
- `created_at`
- `updated_at`

### Attribution integrity requirement

Creator and editor ids must reference same-hotel `hotel_users.id` values where applicable.

### Publish-state constraint

Publishing must be expressible without duplicating the knowledge row into a second table.

Draft and published states should live on the same record.

### Tenant indexing requirement

Knowledge tables should support efficient listing by:

- `hotel_id`
- `is_published`
- `updated_at`

---

## Management Contracts

### FAQ CRUD contract

The backend should expose trusted operations equivalent to:

```ts
type CreateFaqItemInput = {
  hotelId: string;
  actorHotelUserId: string;
  question: string;
  answer: string;
};

type UpdateFaqItemInput = {
  hotelId: string;
  faqItemId: string;
  actorHotelUserId: string;
  question: string;
  answer: string;
};

type DeleteFaqItemInput = {
  hotelId: string;
  faqItemId: string;
  actorHotelUserId: string;
};
```

### Policy CRUD contract

The backend should expose trusted operations equivalent to:

```ts
type CreatePolicyItemInput = {
  hotelId: string;
  actorHotelUserId: string;
  title: string;
  body: string;
};

type UpdatePolicyItemInput = {
  hotelId: string;
  policyItemId: string;
  actorHotelUserId: string;
  title: string;
  body: string;
};

type DeletePolicyItemInput = {
  hotelId: string;
  policyItemId: string;
  actorHotelUserId: string;
};
```

### Publish-state contract

The backend should expose trusted operations equivalent to:

```ts
type PublishKnowledgeItemInput = {
  hotelId: string;
  itemType: "faq" | "policy";
  itemId: string;
  actorHotelUserId: string;
};

type UnpublishKnowledgeItemInput = {
  hotelId: string;
  itemType: "faq" | "policy";
  itemId: string;
  actorHotelUserId: string;
};
```

Expected behavior:

- publish marks the item as approved for later retrieval;
- unpublish removes it from later AI eligibility;
- repeated publish or unpublish calls remain safe and deterministic.

### Listing contract

The workspace should support hotel-scoped listing of:

- all FAQ items for the hotel;
- all policy items for the hotel;
- their publish state and attribution metadata.

---

## UI Behavior

### Management route behavior

The dashboard should expose a dedicated knowledge management surface under a protected route such as:

- `/dashboard/knowledge`

The exact URL shape may vary, but it must remain clearly separate from inbox operations.

### Content sections behavior

The UI should provide a clear way to manage both:

- FAQ items
- policy items

This may be implemented as tabs, segmented controls, or stacked sections.

### Editor behavior

The management UI should allow hotel admins to:

- create new items;
- edit existing items;
- delete items;
- publish and unpublish items.

### Metadata behavior

Each visible knowledge item should show enough metadata to support governance, at minimum:

- publish state;
- last update timestamp;
- editor or creator name where available.

### Empty state behavior

If a hotel has no FAQ or no policy items yet, the page should show informative empty states rather than a generic error.

### Error behavior

Failed operations must:

- show sanitized feedback;
- avoid leaking foreign-tenant existence;
- avoid misleading partial-success UI.

### Authoring UX constraint

Phase 1 should use simple text inputs and textareas.

No WYSIWYG editor is required in this phase.

---

## Security and Tenant Safety

### Server-authoritative rule

All knowledge mutations must resolve authority from the server-side access context.

The client must not be trusted to declare:

- `hotel_id`
- publish eligibility
- editor identity
- permission to mutate the record

### Role guard rule

Management mutations must require `hotel_admin` access.

### Hidden foreign-resource rule

If a hotel admin attempts to access or mutate another hotel's knowledge record, the system should fail safely without revealing whether the record exists.

### Auditability rule

Knowledge operations should be attributable through existing event logs or equivalent structured logging.

At minimum, the system should distinguish:

- FAQ created
- FAQ updated
- FAQ deleted
- FAQ published
- FAQ unpublished
- policy created
- policy updated
- policy deleted
- policy published
- policy unpublished
- unauthorized or invalid operation rejected

---

## Application Interfaces

### Required backend helpers

Expected server-side helpers are likely to include:

- `listFaqItems(...)`
- `listPolicyItems(...)`
- `createFaqItem(...)`
- `updateFaqItem(...)`
- `deleteFaqItem(...)`
- `publishFaqItem(...)`
- `unpublishFaqItem(...)`
- `createPolicyItem(...)`
- `updatePolicyItem(...)`
- `deletePolicyItem(...)`
- `publishPolicyItem(...)`
- `unpublishPolicyItem(...)`

The exact naming may vary, but knowledge logic should not be duplicated across routes.

### Required frontend surfaces

Expected implementation areas are likely to include:

- `app/dashboard/knowledge/*`
- `components/knowledge/*`
- `lib/knowledge/*`
- `lib/auth/*`
- `lib/events/*`

### Required database surfaces

Expected persistence work is likely to include:

- `supabase/migrations/*`
- `types/database.ts`

---

## Implementation Plan

### Stage 1 - Knowledge schema and typed domain helpers

**Goal**

Create the minimal hotel-scoped data model for FAQ and policy management.

**Tasks**

- add FAQ knowledge table;
- add policy knowledge table;
- update generated database types;
- add typed read helpers and mutation helpers;
- capture editor attribution and publish metadata.

**Expected file areas**

- `supabase/migrations/*`
- `types/database.ts`
- `lib/knowledge/*`

**Acceptance**

- hotel-scoped knowledge rows can be created and listed safely;
- schema supports publish state and attribution without duplicate records.

### Stage 2 - Hotel admin knowledge management UI

**Goal**

Expose a protected dashboard surface for FAQ and policy CRUD.

**Tasks**

- add `/dashboard/knowledge` route;
- add FAQ and policy list views;
- add create and edit forms;
- add empty, loading, and error states;
- expose metadata such as publish state and updated timestamp.

**Expected file areas**

- `app/dashboard/knowledge/*`
- `components/knowledge/*`
- `app/dashboard/layout.tsx`
- `app/globals.css`

**Acceptance**

- hotel admins can create, edit, and delete FAQ and policy items from the dashboard;
- empty and validation states remain clear and predictable.

### Stage 3 - Publish governance and auditability

**Goal**

Make approved knowledge eligibility explicit and traceable.

**Tasks**

- add publish and unpublish actions for both item types;
- ensure published state is visible in the UI;
- log knowledge lifecycle events;
- block non-admin editors safely.

**Expected file areas**

- `app/dashboard/knowledge/*`
- `lib/knowledge/*`
- `lib/events/*`
- `lib/auth/*`

**Acceptance**

- only published items are marked as approved knowledge;
- unauthorized mutations fail safely and are not applied.

### Stage 4 - Verification and Phase 1 handoff readiness

**Goal**

Prepare knowledge management for downstream retrieval work.

**Tasks**

- add helper checks for PH1-06 knowledge contracts;
- add live smoke verification for FAQ and policy CRUD plus publish flow;
- document local manual smoke steps;
- confirm published-vs-draft behavior is ready for PH1-07.

**Expected file areas**

- `tests/ph1-06/*`
- `scripts/*`
- `LOCAL_SETUP.md`
- `.ai/specs/phase1/*`

**Acceptance**

- local verification demonstrates tenant-safe CRUD and publish governance;
- PH1-07 can consume published knowledge without schema ambiguity.

## Implementation Progress

Current status:
- Stage 1 knowledge schema and typed domain helpers completed on `feature/ph1-06-knowledge-management`
- Next target: Stage 2 hotel admin knowledge management UI

Completed:
- [x] Added hotel-scoped FAQ and policy schema with publish metadata and RLS
- [x] Updated database types for PH1-06 knowledge tables
- [x] Added typed knowledge list models and server-side CRUD/publish helpers
- [x] Added `test:ph1-06` helper checks for the new knowledge contracts

Pending:
- [ ] Add `/dashboard/knowledge` management UI
- [ ] Add hotel-admin publish/unpublish controls in the dashboard
- [ ] Add live smoke verification and manual PH1-06 knowledge flow notes

---

## Acceptance Criteria

This feature is complete only if:

1. hotel admins can create, edit, and delete FAQ items for their own hotel;
2. hotel admins can create, edit, and delete policy items for their own hotel;
3. hotel admins can publish and unpublish both item types;
4. published state is visible and deterministic;
5. creator/editor attribution is preserved on knowledge records;
6. cross-tenant access and mutation attempts fail safely;
7. managers cannot use PH1-06 mutation flows;
8. the dashboard shows clear empty, loading, and error states;
9. local verification demonstrates the full CRUD plus publish lifecycle;
10. the resulting knowledge store is ready for PH1-07 retrieval work.

---

## Test Plan

### Unit tests

- FAQ create/update/delete helpers behave correctly;
- policy create/update/delete helpers behave correctly;
- publish and unpublish helpers behave idempotently;
- role and tenant guards reject invalid mutations safely.

### Integration tests

- authenticated hotel admin can manage FAQ items end to end;
- authenticated hotel admin can manage policy items end to end;
- published state changes are reflected in subsequent list reads;
- foreign-tenant knowledge access fails safely;
- manager-role mutation attempts are rejected.

### UI checks

- knowledge route is visible and usable for hotel admins;
- FAQ and policy forms show validation feedback;
- publish state badges remain stable after mutations;
- empty knowledge lists show informative placeholders.

### Manual smoke verification

- hotel admin creates a draft FAQ item;
- hotel admin publishes the FAQ item;
- hotel admin creates and edits a policy item;
- hotel admin unpublishes one item and confirms it remains stored but no longer approved.

---

## Verification Commands

Core checks once implementation begins:

```bash
npm run typecheck
npm run test:ph1-05
npm run test:ph1-06
```

Smoke checks once a local flow is added:

```bash
npm run verify:ph1-06
```

Execution note:

- PH1-06 should be validated with real hotel-scoped records, not only isolated helper tests;
- verification should explicitly distinguish draft knowledge from published knowledge.

---

## Dependencies for Next Features

This feature must be finished before:

- PH1-07 Knowledge retrieval for Copilot
- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow

Those features may assume that published hotel knowledge already exists as a governed tenant-safe source of truth.

---

## Open Assumptions Locked for This Spec

- Phase 1 uses separate FAQ and policy stores rather than a full generalized content platform.
- `hotel_admin` is the only editing role for PH1-06 management flows.
- Plain text authoring is sufficient for Phase 1 knowledge management.
- Publish state on the record itself determines downstream AI eligibility.
