# Phase 1 Feature Decomposition

This document decomposes Phase 1 into implementation-ready product features.

It is the planning layer between the global phase spec and future feature-level specs. Each feature below should become its own dedicated technical specification before implementation starts on that slice.

Source phase spec:

- [phase1_foundation_spec_full.md](/c:/REPO/hotelAI/phase1_foundation_spec_full.md)

---

## Decomposition Principles

- Phase 1 remains a single coherent release: AI Copilot for one hotel.
- Every feature must preserve tenant-safe contracts even in a single-hotel pilot.
- AI reply generation is included in Phase 1, but only with human approval before send.
- Transactional truth, autonomous replies, and booking flows stay out of scope.

---

## Recommended Spec Queue

| ID | Feature | Priority | Depends on | Suggested spec file |
| --- | --- | --- | --- | --- |
| PH1-01 | Tenant foundation and staff access | P0 | - | `.ai/specs/phase1/ph1-01-tenant-foundation.md` |
| PH1-02 | Hotel setup and Telegram integration | P0 | PH1-01 | `.ai/specs/phase1/ph1-02-telegram-setup.md` |
| PH1-03 | Inbound messaging ingestion | P0 | PH1-01, PH1-02 | `.ai/specs/phase1/ph1-03-inbound-ingestion.md` |
| PH1-04 | Conversation workspace UI | P0 | PH1-01, PH1-03 | `.ai/specs/phase1/ph1-04-conversation-workspace.md` |
| PH1-05 | Conversation operations | P1 | PH1-04 | `.ai/specs/phase1/ph1-05-conversation-operations.md` |
| PH1-06 | Knowledge base management | P0 | PH1-01 | `.ai/specs/phase1/ph1-06-knowledge-management.md` |
| PH1-07 | Knowledge retrieval for Copilot | P0 | PH1-03, PH1-06 | `.ai/specs/phase1/ph1-07-knowledge-retrieval.md` |
| PH1-08 | AI draft generation | P0 | PH1-03, PH1-07 | `.ai/specs/phase1/ph1-08-ai-draft-generation.md` |
| PH1-09 | Human-approved outbound reply flow | P0 | PH1-02, PH1-04, PH1-08 | `.ai/specs/phase1/ph1-09-approved-reply-flow.md` |
| PH1-10 | Observability, audit, and release acceptance | P1 | PH1-03, PH1-08, PH1-09 | `.ai/specs/phase1/ph1-10-observability-and-qa.md` |

---

## Feature Breakdown

## PH1-01 - Tenant foundation and staff access

**Goal**

Create the tenant-safe application foundation for hotel staff access.

**Why it exists**

All later features depend on reliable auth, role mapping, and hotel scoping.

**In scope**

- Supabase Auth integration for staff;
- `hotel_users` mapping and roles;
- tenant resolution for the current session;
- RLS strategy for hotel-scoped entities;
- server-side guards for hotel-bound access.

**Out of scope**

- self-serve hotel signup;
- billing;
- multi-hotel switching in UI.

**Main outputs**

- auth flow;
- role guard utilities;
- hotel-scoped data access pattern;
- RLS-ready schema contracts.

**Acceptance focus**

- a staff user only sees and mutates data for the correct `hotel_id`;
- protected routes and APIs reject foreign hotel access.

---

## PH1-02 - Hotel setup and Telegram integration

**Goal**

Allow one hotel to connect and use one Telegram bot integration safely.

**Why it exists**

Telegram is the only live channel in Phase 1, so integration setup must be explicit and reliable.

**In scope**

- `channel_integrations` model;
- secure bot token storage;
- active Telegram integration lookup;
- webhook registration assumptions and operational setup data;
- outbound Telegram client abstraction.

**Out of scope**

- multiple active bots per hotel;
- non-Telegram channels;
- rich Telegram UI features like buttons and callback flows.

**Main outputs**

- integration config storage;
- Telegram client service;
- stable channel contract for later messaging features.

**Acceptance focus**

- the system can resolve the correct Telegram integration for the hotel;
- bot credentials are never exposed client-side.

---

## PH1-03 - Inbound messaging ingestion

**Goal**

Receive Telegram guest messages and turn them into tenant-scoped domain records.

**Why it exists**

This is the first operational entry point into the product.

**In scope**

- Telegram webhook route;
- supported update parsing for text messages;
- guest resolution or creation;
- conversation resolution or creation;
- inbound message persistence;
- idempotency for duplicate Telegram deliveries.

**Out of scope**

- media message support;
- auto-replies;
- deep AI reasoning during webhook handling.

**Main outputs**

- inbound webhook processing flow;
- guest, conversation, and message records;
- unread count and preview updates.

**Acceptance focus**

- duplicate webhook deliveries do not create duplicate inbound messages;
- new guest messages reliably appear in the hotel inbox.

---

## PH1-04 - Conversation workspace UI

**Goal**

Give staff a usable inbox and conversation detail workspace for daily operations.

**Why it exists**

Phase 1 is not useful unless managers can review messages, context, and drafts in one place.

**In scope**

- inbox page;
- conversation detail page;
- guest summary card;
- message timeline;
- draft display area;
- loading, empty, and error states.

**Out of scope**

- advanced analytics dashboards;
- real-time collaboration presence;
- omnichannel inbox abstractions.

**Main outputs**

- usable staff inbox;
- conversation context screen;
- UI surface for AI draft review.

**Acceptance focus**

- staff can open conversations, inspect timeline history, and work from one screen.

---

## PH1-05 - Conversation operations

**Goal**

Support basic conversation workflow management inside the inbox.

**Why it exists**

Managers need simple operational controls even before broader automation.

**In scope**

- statuses `new`, `open`, `pending`, `closed`;
- assignment to a hotel user;
- unread clearing behavior;
- filters `all`, `unread`, `assigned_to_me`.

**Out of scope**

- SLA routing;
- team queues with advanced permissions;
- escalation automations.

**Main outputs**

- conversation assignment API;
- status update API;
- consistent unread and filter logic.

**Acceptance focus**

- managers can assign a conversation and change status;
- inbox filters reflect those state changes correctly.

---

## PH1-06 - Knowledge base management

**Goal**

Create the smallest usable hotel knowledge management surface for Copilot.

**Why it exists**

Copilot quality depends on approved hotel information, not freeform model recall.

**In scope**

- FAQ item CRUD;
- policy item CRUD;
- publish and unpublish flow;
- ownership/editor attribution;
- hotel-scoped knowledge storage.

**Out of scope**

- full document ingestion pipeline;
- embeddings and vector search;
- external document sync.

**Main outputs**

- curated FAQ store;
- policy store;
- publish-state governance for Phase 1 knowledge.

**Acceptance focus**

- only published knowledge is eligible for AI assistance;
- hotel admins can manage content without cross-tenant leakage.

---

## PH1-07 - Knowledge retrieval for Copilot

**Goal**

Provide tenant-scoped retrieval of approved hotel knowledge for informational replies.

**Why it exists**

AI drafts need evidence-based support, even with a minimal KB.

**In scope**

- retrieval service over published FAQ and policy content;
- precedence rules for structured policy answers;
- retrieval references for observability;
- no-answer behavior when evidence is missing.

**Out of scope**

- live transactional tools;
- broad semantic search over uncurated documents;
- retrieval across hotels.

**Main outputs**

- retrieval service for Copilot prompts;
- normalized evidence references passed into draft generation.

**Acceptance focus**

- retrieval stays within `hotel_id`;
- missing evidence leads to fallback or clarification, not fabricated certainty.

---

## PH1-08 - AI draft generation

**Goal**

Generate 1-3 AI reply drafts for supported informational guest requests.

**Why it exists**

This is the core user-visible Copilot capability in Phase 1.

**In scope**

- lightweight draft-generation orchestration;
- prompt inputs from conversation context and retrieved knowledge;
- `ai_drafts` persistence;
- draft metadata such as confidence label and retrieval refs;
- regenerate drafts action.

**Out of scope**

- autonomous sending;
- transactional tool use;
- production booking logic;
- complaint-resolution automation.

**Main outputs**

- stored drafts;
- Copilot generation service;
- safe fallback behavior for unsupported queries.

**Acceptance focus**

- supported informational messages produce 1-3 drafts;
- transactional or sensitive requests do not produce unsafe factual drafts.

---

## PH1-09 - Human-approved outbound reply flow

**Goal**

Let the manager select, edit, and send the final reply to the guest.

**Why it exists**

Human approval is the main safety boundary of Phase 1.

**In scope**

- draft selection;
- draft editing before send;
- manual reply path without draft;
- outbound Telegram send;
- message persistence with `source_draft_id`;
- send failure handling and retry-safe status.

**Out of scope**

- automatic sending;
- scheduled follow-ups;
- rich message formatting beyond basic text.

**Main outputs**

- send reply API;
- outbound message persistence;
- traceability from draft to final sent message.

**Acceptance focus**

- no AI-generated text is sent without explicit human action;
- final outbound reply can be traced to draft usage or manual authoring.

---

## PH1-10 - Observability, audit, and release acceptance

**Goal**

Make Phase 1 measurable, debuggable, and safe to release.

**Why it exists**

We need trustworthy traces for messaging, retrieval, draft generation, and send outcomes before expanding automation.

**In scope**

- event log schema and event emission;
- draft selection telemetry;
- seed data for realistic flows;
- release acceptance scenarios;
- QA checklist mapped to phase acceptance criteria.

**Out of scope**

- advanced BI dashboards;
- full experimentation platform;
- cost optimization analytics.

**Main outputs**

- structured events;
- acceptance test checklist;
- release-readiness evidence for the pilot.

**Acceptance focus**

- key system events are queryable and attributable;
- pilot acceptance can be verified end-to-end.

---

## Recommended Implementation Order

1. PH1-01 Tenant foundation and staff access
2. PH1-02 Hotel setup and Telegram integration
3. PH1-03 Inbound messaging ingestion
4. PH1-04 Conversation workspace UI
5. PH1-06 Knowledge base management
6. PH1-07 Knowledge retrieval for Copilot
7. PH1-08 AI draft generation
8. PH1-09 Human-approved outbound reply flow
9. PH1-05 Conversation operations
10. PH1-10 Observability, audit, and release acceptance

## Recommended Spec Authoring Order

1. `ph1-01-tenant-foundation.md`
2. `ph1-02-telegram-setup.md`
3. `ph1-03-inbound-ingestion.md`
4. `ph1-04-conversation-workspace.md`
5. `ph1-06-knowledge-management.md`
6. `ph1-07-knowledge-retrieval.md`
7. `ph1-08-ai-draft-generation.md`
8. `ph1-09-approved-reply-flow.md`
9. `ph1-05-conversation-operations.md`
10. `ph1-10-observability-and-qa.md`

## Release Cut Rule

Phase 1 should not be considered ready if any of the following are missing:

- tenant-safe access control;
- inbound Telegram ingestion;
- knowledge-backed AI draft generation;
- human approval before send;
- draft and send audit trail.
