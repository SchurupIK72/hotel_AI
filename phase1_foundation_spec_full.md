# Phase 1 - AI Copilot Foundation Spec

## 1. Goal

Phase 1 is the first useful production milestone for the product.

By the end of this phase, one hotel should be able to:

1. connect one Telegram bot;
2. receive guest messages into the system;
3. store guests, conversations, and messages in the database;
4. view an inbox and conversation history in the dashboard;
5. retrieve approved hotel knowledge for informational questions;
6. generate 1-3 AI reply drafts for the hotel manager;
7. let the manager edit or approve a draft before sending;
8. send the final approved reply back to Telegram;
9. log draft generation, selected reply, and send outcome;
10. preserve tenant-safe contracts even though the first rollout is for one hotel.

Phase 1 is not an infra-only step. It is the AI Copilot release.

---

## 2. In Scope

- single-hotel pilot with tenant-safe architecture;
- Telegram webhook and outbound Telegram messaging;
- Supabase schema, auth, and RLS;
- dashboard inbox and conversation detail view;
- manual reply composer;
- AI-generated suggested replies;
- minimal knowledge base for approved hotel information;
- KB-backed answer assistance for informational questions;
- human approval before every outbound reply;
- basic event logging and operational analytics.

## 3. Out of Scope

- autonomous replies without human approval;
- FAQ auto-replies;
- intent auto-routing for production decisions;
- multilingual auto-translation as a core feature;
- live availability and pricing;
- booking creation, payment links, or reservation changes;
- WhatsApp, Instagram, or web chat;
- self-serve SaaS onboarding and billing.

---

## 4. Business Outcome

After Phase 1, the hotel team should have a working operations inbox with AI assistance, not just message storage.

The expected product value is:

- faster first response from managers;
- more consistent answers for common operational questions;
- traceable approval flow for every outbound message;
- real conversation data for improving future automation;
- a safe base for Phase 2 semi-automation.

---

## 5. Roles

### 5.1 Super Admin

Internal platform role.

Can:

- create and manage hotels;
- inspect system logs;
- support rollout and configuration.

### 5.2 Hotel Admin

Primary admin for a hotel.

Can:

- manage hotel users;
- configure Telegram integration;
- manage hotel knowledge sources and FAQ content;
- view all hotel conversations and analytics.

### 5.3 Manager

Staff operator who replies to guests.

Can:

- view assigned and unassigned conversations for the hotel;
- open conversation history;
- request or refresh AI drafts;
- edit a draft;
- send an approved reply;
- change conversation status;
- assign a conversation.

### 5.4 Guest

External Telegram user.

Can:

- send messages to the hotel bot;
- receive manager-approved replies.

---

## 6. Core User Stories

### 6.1 Guest message intake

As a guest, I want to send a Telegram message and have the hotel receive it inside the dashboard.

Acceptance:

- the webhook accepts Telegram text messages;
- the message is stored in the database;
- a guest record is created or resolved;
- a conversation is created or resolved;
- the inbox shows a new unread conversation or updated unread count.

### 6.2 Inbox for staff

As a manager, I want to see current conversations in one inbox so I can triage guest messages quickly.

Acceptance:

- conversations are sorted by latest message;
- unread count is visible;
- status and assignee are visible;
- last message preview and timestamp are visible.

### 6.3 Conversation detail with evidence

As a manager, I want to open a conversation and see message history plus AI support context.

Acceptance:

- full timeline is visible;
- message direction and timestamps are visible;
- guest information is visible;
- the UI can show retrieved KB snippets used for AI draft generation.

### 6.4 AI draft generation

As a manager, I want the system to suggest 1-3 replies based on the conversation and approved hotel knowledge.

Acceptance:

- drafts are generated only for supported informational use cases;
- drafts are based on retrieved KB evidence when knowledge is used;
- the system stores the generated drafts and related metadata;
- the UI shows draft text and basic confidence or rationale metadata.

### 6.5 Human approval before send

As a manager, I want to edit or approve a draft before it is sent to the guest.

Acceptance:

- no AI draft is sent automatically;
- the manager can edit a draft before sending;
- the final sent reply is stored separately from generated drafts;
- selection and send outcome are logged.

### 6.6 Safe fallback

As a manager, I want the system to avoid overconfident answers when knowledge is missing or the request is sensitive.

Acceptance:

- the assistant can return no draft or a cautious clarification draft;
- complaints, refunds, VIP cases, and policy exceptions are marked for handoff, not confident AI answers;
- transactional requests do not produce invented pricing or availability.

---

## 7. Phase 1 User Flows

### Flow 1 - New guest writes for the first time

1. Guest sends a Telegram message.
2. Webhook receives the update.
3. The system resolves the hotel from the integration record.
4. The system resolves or creates the guest.
5. The system resolves or creates the active conversation.
6. The system stores the inbound message.
7. The conversation preview, unread count, and last message timestamp are updated.
8. The system optionally queues AI draft generation for the conversation.
9. The dashboard shows the updated conversation.

### Flow 2 - Manager opens a conversation

1. Manager signs in to the dashboard.
2. Manager sees only conversations for the current hotel.
3. Manager opens a conversation.
4. The system loads conversation messages, guest details, latest drafts, and retrieved KB snippets.
5. The unread count is cleared or reduced according to the read rule.

### Flow 3 - AI draft is generated

1. The system receives a new inbound message or the manager requests refresh.
2. The orchestrator classifies the message at a lightweight Copilot level.
3. If the question is informational, the system retrieves approved KB evidence.
4. The AI generates 1-3 draft replies.
5. The drafts are stored with source references and metadata.
6. The dashboard shows the drafts to the manager.

### Flow 4 - Manager approves and sends

1. Manager selects a draft or writes a manual reply.
2. Manager edits the text if needed.
3. Backend validates hotel scope and conversation state.
4. Backend sends the message through Telegram.
5. The outbound message is stored in the database.
6. Draft selection, final text, and send status are logged.
7. The conversation view updates.

---

## 8. Functional Requirements

### 8.1 Authentication and tenant scope

- staff sign-in uses Supabase Auth;
- every staff user is mapped to `hotel_id`;
- every read and write path is scoped by `hotel_id`;
- RLS is required on tenant tables even in the pilot rollout.

### 8.2 Telegram integration

- the system stores one active Telegram integration for the pilot hotel;
- webhook endpoint receives Telegram updates;
- only supported update types are processed in Phase 1;
- outbound replies are sent server-side only.

### 8.3 Messaging persistence

- inbound and outbound messages are stored in the database;
- raw payload may be stored for integration debugging;
- normalized message fields are stored for product logic;
- Telegram duplicate delivery must not create duplicate stored messages.

### 8.4 Inbox and conversation UI

- inbox page lists conversations;
- conversation page shows timeline and reply area;
- filters include `all`, `unread`, and `assigned_to_me`;
- UI states include loading, empty, and error.

### 8.5 AI Copilot behavior

- AI drafts are suggestions only;
- 1-3 drafts may be returned;
- drafts are for informational assistance only in Phase 1;
- transactional data must not be fabricated;
- if required knowledge is missing, the assistant should propose clarification or escalation wording instead of a confident answer.

### 8.6 Knowledge base minimum capability

- the hotel can manage a small curated FAQ or policy set;
- approved content is stored with ownership and publish status;
- retrieval is scoped to the current hotel;
- structured policy fields take precedence over long-form documents where both exist.

### 8.7 Conversation management

Minimum conversation statuses:

- `new`
- `open`
- `pending`
- `closed`

Minimum conversation modes for Phase 1:

- `copilot_mode`
- `human_handoff_mode`

Minimum assignment states:

- unassigned
- assigned

---

## 9. AI and Safety Rules

### 9.1 Allowed draft classes

Phase 1 drafts may assist with:

- check-in and check-out questions;
- breakfast, parking, amenities, and pet policy;
- location and hotel services;
- other approved informational content from the hotel KB.

### 9.2 Blocked or restricted classes

Phase 1 must not generate authoritative final answers for:

- live room availability;
- live pricing;
- booking confirmation or booking status;
- refunds or compensation;
- policy exceptions;
- VIP or complaint handling that requires human judgment.

### 9.3 Human approval rule

- every outbound reply requires explicit human action;
- draft generation does not imply send permission;
- the final sent message may differ from the selected draft;
- the system stores whether the manager used a draft, edited a draft, or wrote a manual reply.

---

## 10. Knowledge Requirements

### 10.1 Minimum sources

Phase 1 knowledge can start with:

- FAQ entries;
- check-in and check-out policy;
- amenities and service information;
- parking, breakfast, and pet rules;
- location or directions content.

### 10.2 Knowledge governance

- each knowledge item belongs to a hotel;
- each knowledge item has `draft` or `published` state;
- only published content is eligible for retrieval;
- each item has an owner or last editor;
- stale or wrong content can be unpublished without deleting history.

### 10.3 Retrieval behavior

- retrieval must be scoped by `hotel_id`;
- only published content may be used for draft generation;
- retrieved evidence should be stored or referenced for observability;
- if no evidence is found, the system should avoid confident factual drafting.

---

## 11. Data Model

### 11.1 Core entities

- `hotels`
- `hotel_users`
- `channel_integrations`
- `guests`
- `conversations`
- `messages`
- `event_logs`

### 11.2 Copilot and knowledge entities

- `knowledge_sources`
- `knowledge_documents`
- `faq_items`
- `policies`
- `ai_drafts`
- `draft_feedback_labels`

### 11.3 Required additions for Copilot

`conversations`

- `mode text not null default 'copilot_mode'`
- `last_ai_draft_at timestamptz null`

`messages`

- `source_draft_id uuid null references ai_drafts(id)`

`ai_drafts`

- `id uuid pk`
- `hotel_id uuid not null references hotels(id)`
- `conversation_id uuid not null references conversations(id)`
- `message_id uuid not null references messages(id)`
- `draft_index int not null`
- `draft_text text not null`
- `source_type text not null check (source_type in ('kb','fallback','manual_trigger'))`
- `status text not null check (status in ('generated','selected','sent','discarded')) default 'generated'`
- `retrieval_refs jsonb null`
- `model_name text null`
- `confidence_label text null`
- `created_at timestamptz not null default now()`
- `selected_at timestamptz null`
- `selected_by_hotel_user_id uuid null references hotel_users(id)`

### 11.4 Knowledge tables

`faq_items`

- `id uuid pk`
- `hotel_id uuid not null references hotels(id)`
- `question text not null`
- `answer text not null`
- `status text not null check (status in ('draft','published'))`
- `owner_hotel_user_id uuid null references hotel_users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`policies`

- `id uuid pk`
- `hotel_id uuid not null references hotels(id)`
- `policy_type text not null`
- `title text not null`
- `content text not null`
- `status text not null check (status in ('draft','published'))`
- `owner_hotel_user_id uuid null references hotel_users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

---

## 12. API and Backend Contract

### 12.1 Telegram webhook

`POST /api/webhooks/telegram/[integrationId]`

Behavior:

- validates integration;
- persists supported inbound message payloads;
- resolves guest and conversation;
- performs idempotency check on Telegram message identifiers;
- triggers AI draft generation for eligible messages.

### 12.2 Get inbox conversations

`GET /api/conversations?filter=all|unread|assigned`

Returns:

- conversation summary;
- guest display data;
- unread count;
- latest preview;
- status and assignee.

### 12.3 Get conversation detail

`GET /api/conversations/:id`

Returns:

- conversation metadata;
- guest summary;
- message timeline;
- latest AI drafts;
- retrieval evidence references used for the latest drafts.

### 12.4 Generate or refresh drafts

`POST /api/conversations/:id/drafts/regenerate`

Behavior:

- validates hotel scope;
- loads latest relevant conversation context;
- retrieves eligible KB content;
- generates 1-3 drafts;
- stores the drafts and metadata;
- returns the new drafts.

### 12.5 Send reply

`POST /api/conversations/:id/reply`

Request body:

```json
{
  "message_text": "Hello! Check-in starts at 14:00.",
  "source_draft_id": "uuid-or-null"
}
```

Behavior:

- validates access and conversation scope;
- sends the final text via Telegram;
- stores the outbound message;
- marks the source draft as `sent` if used;
- logs send success or failure.

### 12.6 Assign conversation

`POST /api/conversations/:id/assign`

### 12.7 Update status

`POST /api/conversations/:id/status`

### 12.8 Knowledge management

Minimum Phase 1 endpoints or equivalent server actions:

- create/update FAQ item;
- publish/unpublish FAQ item;
- create/update policy item;
- publish/unpublish policy item.

---

## 13. Domain Rules

### 13.1 Guest resolution

Guest is resolved by:

- `hotel_id`
- `channel = telegram`
- `external_user_id = telegram.from.id`

Create the guest if none exists.

### 13.2 Conversation resolution

For MVP:

- reuse the most recent active conversation for the guest with status `new`, `open`, or `pending`;
- otherwise create a new conversation.

### 13.3 Read and unread logic

- inbound guest message increases `unread_count`;
- opening the conversation or explicit mark-as-read clears it according to the chosen UI flow;
- outbound staff reply does not increase unread count.

### 13.4 Draft selection logic

- multiple drafts can exist for one inbound message;
- only one draft can be recorded as the source of a sent message;
- unused drafts remain available for audit unless explicitly discarded.

### 13.5 Preview logic

For every stored message:

- update `last_message_preview`;
- update `last_message_at`.

### 13.6 Idempotency

- Telegram duplicate deliveries must be recognized by external identifiers;
- duplicate webhook deliveries must not create duplicate inbound messages or duplicate drafts for the same source message.

---

## 14. Observability

Minimum events:

- `telegram_webhook_received`
- `telegram_webhook_ignored`
- `guest_created`
- `guest_resolved`
- `conversation_created`
- `conversation_resolved`
- `message_inbound_saved`
- `kb_retrieval_requested`
- `kb_retrieval_completed`
- `ai_drafts_generated`
- `ai_draft_selected`
- `ai_draft_discarded`
- `message_outbound_send_requested`
- `message_outbound_sent`
- `message_outbound_failed`
- `conversation_assigned`
- `conversation_status_changed`

For draft generation, log:

- conversation id;
- triggering message id;
- hotel id;
- retrieval references;
- model used;
- draft count;
- high-level confidence label if available.

---

## 15. Non-Functional Requirements

### 15.1 Security

- strict tenant isolation;
- no service-role secret on the client;
- Telegram send happens server-side only;
- knowledge retrieval respects hotel boundaries.

### 15.2 Reliability

- webhook processing must be resilient to duplicate deliveries;
- send failures must be visible and logged;
- AI draft failures must degrade gracefully without breaking the inbox.

### 15.3 Performance

- inbox should load quickly on MVP-sized data;
- draft generation can be asynchronous relative to inbox render if needed;
- conversation detail should render before or alongside draft results rather than blocking the whole page.

### 15.4 Maintainability

- prompts are versioned and separated from core business rules;
- critical safety rules are enforced in code, not prompts only;
- domain logic stays outside Telegram adapter code.

---

## 16. Acceptance Criteria

Phase 1 is complete only if:

1. one Telegram bot can be connected to one hotel;
2. inbound Telegram messages are stored reliably;
3. guests and conversations are resolved correctly within hotel scope;
4. hotel staff can view an inbox and conversation history;
5. the system can retrieve approved hotel knowledge for informational replies;
6. the system can generate 1-3 AI drafts for supported informational conversations;
7. the manager can edit or approve a draft before sending;
8. the guest receives the approved final reply in Telegram;
9. every outbound reply is human-triggered, never auto-sent;
10. draft generation, draft selection, and send outcome are logged;
11. transactional questions do not return invented live pricing or availability;
12. complaints, refunds, and policy exceptions are routed to cautious fallback or handoff behavior;
13. tenant scoping is enforced in data access and retrieval.

---

## 17. Backlog by Epic

### Epic A - Project setup

- initialize Next.js app;
- configure Tailwind;
- configure Supabase clients;
- define env vars and secrets handling.

### Epic B - Auth and tenant access

- Supabase Auth setup;
- hotel user mapping;
- role guards;
- tenant resolution helper.

### Epic C - Database schema

- core messaging tables;
- knowledge tables;
- `ai_drafts` table;
- indexes and RLS policies.

### Epic D - Telegram integration

- Telegram client abstraction;
- webhook route;
- inbound parser;
- guest and conversation resolution;
- idempotent message persistence.

### Epic E - Knowledge and retrieval

- FAQ and policy CRUD;
- publish/unpublish flow;
- hotel-scoped retrieval service;
- retrieval evidence formatting for Copilot.

### Epic F - AI Copilot

- prompt and orchestration for draft generation;
- draft persistence;
- regenerate drafts action;
- safety rules for unsupported classes.

### Epic G - Dashboard UI

- inbox page;
- conversation page;
- draft cards;
- composer and send flow;
- error and empty states.

### Epic H - Logging and QA

- event logs;
- draft selection telemetry;
- seed data;
- acceptance scenario checks.

---

## 18. Priority Order

### P0

- core schema and RLS;
- Telegram webhook;
- inbound persistence;
- inbox and conversation view;
- minimal knowledge management;
- AI draft generation;
- manager-approved send flow.

### P1

- draft regeneration UX;
- assignment and status changes;
- retrieval evidence display;
- draft feedback labeling.

### P2

- better filtering;
- richer analytics;
- internal admin tooling.

---

## 19. Explicit Technical Debt Accepted in Phase 1

Allowed:

- Telegram as the only channel;
- text messages only;
- small curated KB instead of a full ingestion pipeline;
- lightweight retrieval before full document RAG;
- basic confidence labels rather than advanced evaluation scoring.

Not allowed:

- tenant leakage;
- auto-send of AI responses;
- fabricated transactional data;
- missing audit trail for AI drafts and sent messages;
- business-critical safety constraints enforced only in prompts.

---

## 20. QA Checklist

- new guest writes for the first time -> guest, conversation, and message are created;
- existing guest writes again -> message is attached to the current active conversation;
- duplicate Telegram delivery does not create duplicate messages;
- manager sees only hotel-scoped conversations;
- manager sees AI drafts for supported informational messages;
- KB evidence shown for a generated draft matches the hotel scope;
- manager can send an edited draft;
- outbound message reaches Telegram;
- send failure is logged and shown;
- pricing or availability requests do not return invented answers;
- complaint or policy-exception cases fall back safely;
- selected draft is traceable from the final outbound message.

---

## 21. Deliverables

At the end of Phase 1 we should have:

- database migrations;
- Telegram webhook and send integration;
- inbox and conversation UI;
- minimal knowledge management;
- AI draft generation flow;
- manager approval send flow;
- RLS and tenant guards;
- event logging and basic analytics hooks;
- deployment and setup documentation.

---

## 22. What Comes Next

The next phase is **Phase 2 - Semi-Automated Concierge**.

It should extend the Copilot foundation with:

- selected FAQ auto-replies;
- explicit handoff rules;
- lead capture for booking intent;
- broader multilingual handling;
- tighter analytics and confidence controls.
