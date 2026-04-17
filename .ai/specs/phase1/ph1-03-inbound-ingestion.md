# PH1-03 - Inbound Messaging Ingestion

> **Created:** 2026-04-16
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** In Progress
> **Depends on:** PH1-01 - Tenant Foundation and Staff Access, PH1-02 - Hotel Setup and Telegram Integration

---

## Summary

This feature turns the reserved Telegram webhook endpoint into the first live operational entry point of the product.

It defines how supported Telegram updates are validated, normalized, deduplicated, and persisted as tenant-scoped `guests`, `conversations`, and `messages`.

Without this feature, the connected Telegram bot cannot produce inbox data, AI drafts cannot be triggered from real guest input, and the hotel dashboard remains operationally empty.

---

## Product Intent

Phase 1 becomes useful only when a real guest message can safely arrive from Telegram and appear in the hotel system.

This feature exists to make inbound guest messaging reliable, tenant-safe, and reusable for later inbox, Copilot, and outbound reply features.

### Must-have outcomes

- the Telegram webhook endpoint accepts supported inbound updates for the active hotel integration;
- the backend resolves the correct hotel from trusted integration state;
- a guest is resolved or created for the Telegram sender;
- a conversation is resolved or created for that guest;
- the inbound message is persisted exactly once even if Telegram retries delivery;
- conversation unread and preview state is updated for inbox use.

### Out of scope

- media attachments, voice, files, stickers, location, or contact messages;
- automatic guest-facing replies;
- AI draft generation inside the webhook transaction;
- advanced spam filtering or anti-abuse heuristics;
- omnichannel ingestion beyond Telegram.

---

## Product Rules

### Live ingress rule

After PH1-03 is implemented, the Telegram webhook route is no longer `reserved_endpoint_only`.

It becomes the first live ingress path for supported Telegram text messages.

### Tenant resolution rule

The hotel must be resolved from the trusted integration record identified by the webhook path token.

The webhook must not trust client-supplied hotel identifiers.

### Supported update rule

Phase 1 inbound handling supports only Telegram message updates that contain:

- a bot-targeted inbound update;
- a `message` object;
- plain text content;
- a resolvable sender identity.

Unsupported update types must be ignored safely and logged as non-actionable.

### Idempotency rule

Telegram duplicate deliveries must not create duplicate stored messages, duplicate guest rows, or duplicate conversation state transitions for the same inbound message.

### Webhook latency rule

The webhook path should do only the minimum synchronous work required to:

- validate the request;
- persist normalized inbound records;
- emit operational events;
- return a stable response to Telegram.

Later AI and inbox enrichment work may happen after persistence.

---

## Domain Scope

### New domain records introduced or activated by this feature

- `guests`
- `conversations`
- `messages`
- optional `telegram_webhook_events` or equivalent raw-update audit store if needed

### Existing dependencies

- `hotels`
- `hotel_users`
- `channel_integrations`

### Downstream features that depend on this output

- PH1-04 Conversation workspace UI
- PH1-07 Knowledge retrieval for Copilot
- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow
- PH1-10 Observability, audit, and release acceptance

---

## Data Model Requirements

### Required table: `guests`

- `id uuid pk`
- `hotel_id uuid not null references hotels(id)`
- `channel text not null check (channel in ('telegram'))`
- `external_user_id text not null`
- `telegram_username text null`
- `display_name text null`
- `first_name text null`
- `last_name text null`
- `language_code text null`
- `last_message_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique(hotel_id, channel, external_user_id)`

### Required table: `conversations`

- `id uuid pk`
- `hotel_id uuid not null references hotels(id)`
- `guest_id uuid not null references guests(id)`
- `channel text not null check (channel in ('telegram'))`
- `status text not null check (status in ('new','open','pending','closed')) default 'new'`
- `mode text not null check (mode in ('copilot_mode','human_handoff_mode')) default 'copilot_mode'`
- `assigned_hotel_user_id uuid null references hotel_users(id)`
- `subject text null`
- `last_message_preview text null`
- `last_message_at timestamptz not null`
- `last_inbound_message_at timestamptz null`
- `unread_count int not null default 0`
- `last_ai_draft_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Required table: `messages`

- `id uuid pk`
- `hotel_id uuid not null references hotels(id)`
- `conversation_id uuid not null references conversations(id)`
- `guest_id uuid null references guests(id)`
- `channel text not null check (channel in ('telegram'))`
- `direction text not null check (direction in ('inbound','outbound'))`
- `message_type text not null check (message_type in ('text'))`
- `external_message_id text not null`
- `external_chat_id text not null`
- `sender_external_id text null`
- `text_body text not null`
- `source_draft_id uuid null`
- `delivered_at timestamptz null`
- `raw_payload jsonb null`
- `created_at timestamptz not null default now()`
- `unique(hotel_id, channel, direction, external_message_id)`

### Optional raw delivery audit table

If operational debugging requires a separate delivery log, Phase 1 may add a raw webhook-event table or equivalent event log entry keyed by Telegram update id.

If added, it must not replace normalized domain persistence.

### Required indexes

- `guests(hotel_id, channel, external_user_id)`
- `conversations(hotel_id, guest_id, status, last_message_at desc)`
- `messages(hotel_id, conversation_id, created_at)`
- `messages(hotel_id, channel, direction, external_message_id)`
- optional index on webhook-event update id if a raw audit table is added

---

## Guest Resolution Rules

### Guest identity source

Guest identity must be resolved from the Telegram sender identity on the inbound update:

- `hotel_id`
- `channel = telegram`
- `external_user_id = message.from.id`

### Guest create behavior

If no guest exists for the sender in the current hotel, create one using the best available Telegram metadata:

- `telegram_username`
- `first_name`
- `last_name`
- `display_name`
- `language_code`

### Guest update behavior

If the guest already exists, the system may refresh mutable profile fields such as:

- `telegram_username`
- `display_name`
- `language_code`
- `last_message_at`

The system must not create duplicate guests for the same `(hotel_id, channel, external_user_id)`.

---

## Conversation Resolution Rules

### Conversation reuse rule

For Phase 1, the system should reuse the most recent active conversation for the guest when its status is:

- `new`
- `open`
- `pending`

### New conversation rule

Create a new conversation if:

- no active conversation exists for the guest;
- the latest conversation is `closed`;
- or the latest conversation cannot safely be reused.

### New conversation defaults

Newly created conversations must start with:

- `status = new`
- `mode = copilot_mode`
- `unread_count = 0` before message-side updates

### Conversation update behavior after inbound message

After a valid inbound message is saved, the conversation must:

- increment `unread_count` by 1;
- update `last_message_preview`;
- update `last_message_at`;
- update `last_inbound_message_at`;
- remain tenant-scoped to the resolved hotel.

---

## Message Persistence Rules

### Supported inbound message shape

Phase 1 stores only plain text inbound guest messages.

The parser must reject or ignore updates that do not contain a usable text body.

### Required normalized message fields

Every persisted inbound message must capture:

- hotel scope;
- conversation scope;
- guest scope where applicable;
- direction = `inbound`;
- external Telegram message id;
- external chat id;
- sender external id;
- text body;
- normalized timestamps;
- raw payload if retained for debugging.

### External identifiers

At minimum, message persistence must rely on Telegram identifiers that are stable across retries:

- `message.message_id`
- `message.chat.id`
- optionally `update_id` for delivery-level audit

### Duplicate handling

If Telegram retries the same inbound message:

- the system must not create a second `messages` row;
- the system must not increment unread count twice;
- the system must not create a second guest or second conversation for the same source message.

---

## Webhook and Parsing Contracts

### Route contract

`POST /api/webhooks/telegram/[webhookPathToken]`

The route must:

1. resolve integration from `webhookPathToken`;
2. validate that the integration is active;
3. validate optional `secret_token` if configured;
4. parse supported Telegram update shapes;
5. ignore unsupported shapes safely;
6. persist normalized inbound records for supported text messages;
7. emit structured operational events;
8. return a stable success response for accepted deliveries.

### Unsupported update behavior

The route must not fail hard for unsupported Telegram updates that are otherwise valid webhook traffic.

Instead it should:

- log the delivery as ignored;
- classify the ignore reason;
- return a non-error acknowledgment when safe to do so.

### Invalid request behavior

The route must reject:

- unknown webhook path token;
- inactive integration;
- secret mismatch when a secret is configured;
- malformed payload that cannot be parsed as Telegram JSON.

### Parsing contract

The inbound parser should expose a normalized application-facing structure similar to:

```ts
type ParsedInboundTelegramTextMessage = {
  integrationId: string;
  hotelId: string;
  updateId: string | null;
  externalMessageId: string;
  externalChatId: string;
  senderExternalId: string;
  textBody: string;
  sentAt: string | null;
  telegramUser: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    languageCode: string | null;
  };
};
```

The exact internal shape may vary, but later services must consume a normalized domain input rather than raw Telegram payloads directly.

---

## Security and Tenant Safety

### Request trust boundaries

The webhook route must trust only:

- the integration record resolved from the path token;
- the optional webhook secret;
- Telegram payload fields required for parsing.

It must not trust:

- arbitrary hotel identifiers from the request;
- arbitrary conversation identifiers from the request;
- any client-originated tenant metadata.

### RLS requirements

New tenant tables introduced by this feature must be protected by RLS or an equivalent database-level restriction strategy consistent with PH1-01.

Minimum tables:

- `guests`
- `conversations`
- `messages`

### Secret handling

The webhook flow must not expose:

- webhook secret;
- decrypted Telegram bot token;
- service-role secrets;
- raw headers containing secret token material.

### Data exposure rule

Only normalized non-secret messaging metadata should be made available to downstream UI read models.

---

## Operational and Observability Requirements

### Required event types

At minimum, the system must emit or persist observable records for:

- `telegram_webhook_received`
- `telegram_webhook_rejected`
- `telegram_webhook_ignored`
- `guest_created`
- `guest_resolved`
- `conversation_created`
- `conversation_resolved`
- `message_inbound_saved`
- `message_inbound_deduplicated`

### Required event metadata

Each event should include enough context to debug ingestion safely:

- `hotel_id`
- `integration_id`
- `webhook_path_token` only if sanitized or omitted from user-facing logs
- `update_id` when available
- `external_message_id` when available
- high-level outcome
- ignore or rejection reason where applicable

### Failure visibility

Operational failures must be attributable without exposing secrets.

At minimum, the system should distinguish:

- invalid token path;
- invalid secret;
- inactive integration;
- unsupported update type;
- duplicate delivery;
- persistence failure.

---

## Application Interfaces

### Required backend services

- `parseTelegramInboundUpdate(...)`
- `resolveOrCreateGuest(...)`
- `resolveOrCreateConversation(...)`
- `persistInboundMessage(...)`
- `processTelegramInboundUpdate(...)` or equivalent orchestration entry point

### Required route usage pattern

The route should remain thin and delegate business logic to reusable domain services.

Telegram adapter code must not own conversation business rules directly.

### Downstream contract for inbox features

After successful ingestion, later features must be able to query:

- guest profile summary;
- conversation unread state;
- conversation preview and last activity time;
- message timeline ordered by creation time.

---

## UI and Product Surface Impact

### Immediate product impact

This feature does not require the full inbox UI yet, but it must produce the data that PH1-04 will render.

### Operational visibility minimum

Before or alongside PH1-04, local verification should still allow the team to confirm that:

- inbound webhook traffic created a guest;
- a conversation exists for that guest;
- the message was persisted exactly once;
- unread and preview state changed as expected.

### No live staff workflow requirement in this feature

PH1-03 does not need to deliver the final conversation workspace.

It only needs to guarantee that the correct tenant-scoped records exist for the workspace to consume.

---

## Implementation Plan

### Stage 1 - Messaging schema and tenant-safe constraints

**Goal**

Create the minimum durable schema for guests, conversations, and messages.

**Tasks**

- add migrations for `guests`, `conversations`, and `messages`;
- define unique constraints for guest identity and message idempotency;
- add indexes for inbox and conversation lookup patterns;
- enable RLS aligned with hotel-scoped access;
- add updated-at support where needed.

**Expected file areas**

- `supabase/migrations/*`
- `lib/db/*`
- `lib/tenants/*`

**Acceptance**

- the schema can represent inbound guest messaging for one hotel safely;
- duplicate guest and duplicate inbound message persistence are blocked by constraints.

### Stage 2 - Telegram inbound parser and route activation

**Goal**

Turn the reserved Telegram route into a live ingress path for supported text messages.

**Tasks**

- replace `reserved_endpoint_only` route behavior with live ingestion behavior;
- validate active integration and optional webhook secret;
- implement Telegram update parsing for supported text-message payloads;
- classify ignored update types and rejected requests;
- return stable webhook responses.

**Expected file areas**

- `app/api/webhooks/telegram/[webhookPathToken]/route.ts`
- `lib/telegram/*`
- `lib/events/*`

**Acceptance**

- a supported Telegram text update reaches the domain orchestration layer;
- unsupported updates are ignored safely instead of crashing the webhook.

### Stage 3 - Guest, conversation, and inbound message orchestration

**Goal**

Persist normalized domain records from a valid Telegram inbound message exactly once.

**Tasks**

- implement guest resolution or creation;
- implement conversation resolution or creation;
- persist inbound message rows;
- update unread and preview state atomically or safely;
- handle duplicate deliveries without double effects.

**Expected file areas**

- `lib/messages/*`
- `lib/conversations/*`
- `lib/guests/*`
- `lib/telegram/*`
- `tests/*`

**Acceptance**

- new guest messages create or reuse the correct tenant-scoped records;
- duplicate deliveries do not create duplicate messages or double unread increments.

### Stage 4 - Ingestion observability and local verification

**Goal**

Make inbound ingestion debuggable and verifiable before the conversation UI is built.

**Tasks**

- emit structured ingestion events;
- add runnable checks or smoke verification for live local ingestion;
- document how to verify records after webhook delivery;
- ensure PH1-04 can depend on stable read-model fields.

**Expected file areas**

- `tests/ph1-03/*`
- `scripts/*`
- `LOCAL_SETUP.md`
- optional event-log helpers

**Acceptance**

- engineering can verify end-to-end inbound persistence locally;
- ingestion outcomes are queryable and attributable.

---

## Acceptance Criteria

This feature is complete only if:

1. the Telegram webhook route accepts supported inbound text-message updates for an active integration;
2. the system resolves hotel scope from trusted integration state only;
3. a guest is resolved or created correctly from Telegram sender identity;
4. a conversation is resolved or created correctly for the guest;
5. the inbound message is persisted with normalized tenant-scoped fields;
6. duplicate Telegram deliveries do not create duplicate message rows or double unread effects;
7. unsupported Telegram updates are ignored safely and observably;
8. invalid secret, inactive integration, and malformed payload paths fail predictably;
9. conversation preview, last activity, and unread state are updated for downstream inbox use;
10. tenant-scoped tables introduced by this feature are protected by RLS or equivalent database restrictions;
11. no webhook or integration secret leaks into client-facing outputs or ordinary logs;
12. local verification can demonstrate that a real or simulated inbound Telegram message reaches persistent domain records.

---

## Test Plan

### Unit tests

- Telegram inbound parser maps supported text updates into normalized domain input;
- unsupported update shapes are classified correctly;
- guest resolution reuses existing guest for the same `(hotel_id, channel, external_user_id)`;
- conversation resolution reuses an active conversation and creates a new one when only closed history exists;
- duplicate inbound message detection prevents second-write effects.

### Integration tests

- valid webhook request with correct path token and secret persists guest, conversation, and message;
- request with invalid secret is rejected;
- request for inactive integration is rejected;
- duplicate delivery of the same Telegram message does not create a second message row;
- unsupported Telegram update returns safe ignore behavior without persistence;
- conversation unread count and last preview update after a new inbound message.

### Security checks

- no client-facing read model contains webhook secret or bot token;
- tenant-scoped records cannot be read across hotels through normal authenticated access;
- webhook processing does not trust client-provided hotel identifiers;
- operational error logging contains sanitized metadata only.

### Smoke verification

- local environment can simulate or receive a Telegram text message and confirm resulting rows in `guests`, `conversations`, and `messages`;
- repeated delivery of the same payload confirms idempotency behavior.

## Implementation Progress

Current status:

- PH1-03 implementation is functionally complete for the planned inbound ingestion scope;
- PH1-04 already consumes the normalized read-model fields produced by this feature;
- remaining verification work is operational rather than architectural.

- [x] messaging schema for `guests`, `conversations`, and `messages` added with indexes and RLS
- [x] Telegram inbound parser added for supported text-message updates
- [x] webhook route activated from reserved mode into live inbound ingestion
- [x] guest, conversation, and message orchestration added with duplicate-delivery protection
- [x] Telegram settings UI endpoint status updated to reflect live inbound ingestion
- [x] minimal helper verification added via `npm run test:ph1-03`
- [x] local end-to-end smoke verification added via `npm run verify:ph1-03`
- [x] structured ingestion events persisted for webhook receive/reject/ignore and guest/conversation/message outcomes
- [x] route-level validation helpers and checks added for invalid secret, inactive integration, and malformed payload handling
- [x] dependency-injected webhook handler and route integration checks added for success and rejection scenarios
- [x] downstream inbox read-model fields are now consumed by the initial PH1-04 conversation workspace implementation
- [x] PH1-04 verification path added on top of PH1-03 records via `npm run verify:ph1-04` (requires a running local Supabase stack)

## Verification Commands

Core checks:

```bash
npm run typecheck
npm run test:ph1-03
npm run supabase:reset
```

Smoke checks:

```bash
npm run verify:ph1-03
npm run verify:ph1-04
```

Execution note:

- `npm run verify:ph1-03` is the direct PH1-03 smoke path for ingestion persistence and deduplication;
- `npm run verify:ph1-04` is a downstream validation path that confirms the PH1-03 records are usable by the first conversation workspace iteration;
- smoke verification commands require a running local Supabase stack.

---

## Dependencies for Next Features

This feature must be finished before:

- PH1-04 Conversation workspace UI
- PH1-07 Knowledge retrieval for Copilot
- PH1-08 AI draft generation
- PH1-09 Human-approved outbound reply flow
- PH1-10 Observability, audit, and release acceptance

Those features may assume that inbound Telegram traffic already produces stable tenant-scoped guest, conversation, and message records.

Current sync note:

- PH1-04 has already started consuming `guests`, `conversations`, and `messages` from this spec for the first inbox workspace iteration;
- PH1-03 remains the source-of-truth spec for how those records are created, deduplicated, and kept tenant-safe.

---

## Open Assumptions Locked for This Spec

- Telegram remains the only live inbound channel in Phase 1.
- Phase 1 inbound handling supports text messages only.
- AI draft generation is not executed inline in the webhook path and may be triggered after persistence.
- One active Telegram integration per hotel remains the Phase 1 channel model.
- Conversation reuse is based on the latest active conversation for the guest unless later business rules refine that policy.
