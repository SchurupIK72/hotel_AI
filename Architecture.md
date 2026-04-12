# Architecture.md

# AI Hotel Manager — Architecture

## 1. Product goal

We are building an AI manager for hotels that can:
- answer guest questions in Telegram, web chat, and later WhatsApp / Instagram;
- use hotel knowledge to answer accurately;
- help staff with suggested replies in the first phase;
- gradually automate guest communication;
- eventually support availability lookup, lead capture, pre-booking, and booking flows.

The system must be introduced in phases:
1. **AI Copilot** for staff
2. **Semi-automated concierge**
3. **Transactional booking assistant**
4. **Multi-tenant SaaS platform**

This phased rollout is mandatory. We do **not** start with a fully autonomous booking bot.

---

## 2. Product strategy

### Phase A — AI Copilot
The assistant suggests 1–3 replies for the hotel manager, who chooses or edits one before sending.

**Why this phase exists**
- lowest business risk;
- quick launch;
- creates real training data;
- captures hotel tone and common objections;
- avoids incorrect autonomous booking actions.

### Phase B — Semi-automation
The assistant answers simple FAQ automatically and hands off more complex conversations.

**Automate**
- check-in / check-out time;
- parking;
- breakfast;
- pets;
- transfer;
- room amenities;
- location questions;
- local recommendations from approved knowledge.

**Escalate**
- complaints;
- special requests;
- VIP guests;
- refunds;
- corporate / group bookings;
- policy exceptions.

### Phase C — Booking assistant
The assistant can:
- collect booking parameters;
- check availability via tools;
- show room options;
- create a booking request or reservation draft;
- send payment links;
- confirm next steps.

### Phase D — Multi-tenant SaaS
The platform supports many hotels, staff roles, billing, audit logs, and branded deployments.

---

## 3. Core product principles

1. **No hallucinated transactional data**  
   The AI must never invent room availability, pricing, policy exceptions, or booking status.

2. **Tool-gated actions**  
   Any booking-related or operational action must be executed through explicit tools / functions, never by freeform text reasoning.

3. **Human-in-the-loop first**  
   Human approval is required until the copilot stage is stable and metrics support more automation.

4. **Structured knowledge + RAG**  
   Hotel knowledge must be stored both as structured data and indexed documents.

5. **Stateful conversations**  
   The AI should reason over conversation state, not just single messages.

6. **Multi-tenant safety**  
   Every query, retrieval, and tool call must be scoped by `hotel_id`.

7. **Observability first**  
   Log intent classification, retrieval context, tool calls, final answers, confidence, and human overrides.

---

## 4. Recommended stack

### Application layer
- **Next.js** for dashboard and web chat
- **TypeScript** everywhere possible
- **Tailwind CSS** for admin UI

### Data / platform
- **Supabase**
  - Postgres
  - Auth
  - Storage
  - Realtime
  - Edge Functions
- **pgvector** for embeddings and RAG

### AI / orchestration
- **OpenAI API** for:
  - intent classification
  - reply generation
  - tool selection
  - structured extraction
- internal orchestration layer for routing and guardrails

### Automation
- **n8n** for:
  - webhook pipelines
  - notifications
  - CRM sync
  - follow-ups
  - human handoff triggers
  - internal ops workflows

### Channels
- **Telegram Bot API** first
- web chat second
- WhatsApp / other channels later

### Monitoring / analytics
- **PostHog** for product analytics
- **Sentry** for errors
- internal event log for conversation traces

---

## 5. System architecture

## 5.1 High-level layers

### 1) Channel layer
Receives and sends messages from:
- Telegram
- Web chat
- future messaging channels

Responsibilities:
- normalize inbound messages into a common schema;
- identify hotel / tenant;
- identify guest;
- persist raw events.

### 2) Conversation router
Determines:
- tenant context;
- channel context;
- guest profile;
- current conversation state;
- whether to use AI draft, auto-reply, or human escalation.

### 3) AI orchestrator
The central decision engine.

Responsibilities:
- intent detection;
- entity extraction;
- state transition;
- knowledge retrieval;
- tool selection;
- response generation;
- risk evaluation;
- escalation decision.

### 4) Knowledge layer
Contains:
- structured hotel data;
- indexed documents for RAG;
- FAQ;
- policies;
- room descriptions;
- service information;
- local area recommendations.

### 5) Transaction layer
Tool-backed actions:
- check availability;
- calculate price;
- create lead;
- create reservation request;
- send payment link;
- modify / cancel booking when supported;
- create complaint ticket;
- notify staff.

### 6) Staff operations dashboard
Used by hotel staff for:
- inbox;
- handoff;
- suggested replies;
- guest profile;
- knowledge management;
- lead / booking workflows;
- analytics.

### 7) Analytics and logging
Captures:
- automation rate;
- response latency;
- handoff rate;
- successful lead conversion;
- booking conversion;
- missed knowledge;
- confidence and override patterns.

---

## 5.2 Event flow

```text
Guest Message
   ↓
Channel Webhook
   ↓
Inbound Normalizer
   ↓
Conversation Router
   ↓
AI Orchestrator
   ├─ Retrieve hotel context
   ├─ Retrieve KB context
   ├─ Detect intent
   ├─ Extract entities
   ├─ Decide response mode
   └─ Call tools if needed
   ↓
Response Composer
   ├─ AI draft
   ├─ Auto-response
   └─ Handoff package
   ↓
Channel Delivery + Dashboard Updates
```

---

## 6. Conversation modes and states

The assistant must be stateful and operate via explicit conversation modes.

### Core states
- `faq_mode`
- `lead_capture_mode`
- `room_selection_mode`
- `booking_mode`
- `payment_pending_mode`
- `human_handoff_mode`
- `post_booking_support_mode`

### State transition examples
- FAQ → lead capture if the user asks for dates and pricing
- lead capture → room selection when enough information is collected
- room selection → booking when user commits
- any state → handoff if complaint, ambiguity, low confidence, or policy exception is detected

---

## 7. Intent system

Minimum required intents:

- `general_question`
- `availability_check`
- `price_request`
- `room_comparison`
- `booking_request`
- `modify_booking`
- `cancel_booking`
- `complaint_issue`
- `transfer_to_human`
- `local_recommendation`

### Entities to extract
- check-in date
- check-out date
- number of guests
- adults / children
- room type
- budget
- language
- booking id
- special requests
- contact details
- communication channel

All extracted entities should be validated and normalized before use.

---

## 8. Response classes and safety boundaries

### 8.1 Informational responses
Allowed to answer from KB / RAG:
- hotel services;
- check-in times;
- amenities;
- policies already documented;
- area recommendations.

### 8.2 Transactional responses
Must use tools:
- availability;
- live pricing;
- reservation creation;
- booking modification;
- payment links;
- booking status.

### 8.3 Sensitive responses
Require handoff or explicit approval:
- complaints;
- compensation;
- refunds;
- VIP handling;
- legal / policy exceptions;
- disputed charges;
- unsafe content or abuse.

This separation is non-negotiable.

---

## 9. Knowledge architecture

## 9.1 Data sources
- hotel policy PDFs
- room descriptions
- FAQ documents
- markdown docs
- Notion / Docs exports
- CSV / spreadsheets with room and rate metadata
- local recommendations curated by hotel staff

## 9.2 Storage model
Use two parallel representations:

### A) Structured data
Store as database tables:
- room types
- amenities
- policies
- cancellation rules
- check-in / check-out rules
- service availability
- contact info
- language support

### B) Unstructured knowledge
Store and index:
- documents
- FAQs
- SOPs
- destination tips
- longform instructions

## 9.3 RAG pipeline
1. upload source
2. parse content
3. clean content
4. chunk text
5. embed chunks
6. store vectors
7. retrieve relevant chunks at runtime
8. answer only from retrieved evidence

## 9.4 Knowledge quality requirements
- documents need ownership;
- documents must have versioning;
- outdated content must be archived;
- transactional truth should not come from unstructured docs if structured sources exist.

---

## 10. Dashboard requirements

The admin dashboard must include at least these screens:

### 10.1 Inbox
- conversation list
- status
- priority
- channel
- assigned staff member
- AI confidence
- unread count

### 10.2 Conversation view
- message timeline
- suggested replies
- selected reply history
- handoff controls
- retrieved KB snippets
- guest profile card
- action recommendations

### 10.3 Knowledge base
- source list
- document upload
- FAQ editor
- chunk preview
- reindex controls
- publish status

### 10.4 Leads / bookings
- booking requests
- lead stage
- dates and guest details
- requested room
- assigned manager
- source channel
- conversion status

### 10.5 Analytics
- response time
- automation rate
- handoff rate
- intent distribution
- unresolved questions
- lead conversion
- booking conversion

---

## 11. Data model

## 11.1 Core entities
- `hotels`
- `hotel_users`
- `guests`
- `conversations`
- `messages`

## 11.2 Knowledge entities
- `knowledge_sources`
- `knowledge_documents`
- `knowledge_chunks`
- `faq_items`
- `policies`

## 11.3 Commerce / operations entities
- `room_types`
- `rate_plans`
- `availability_snapshots`
- `booking_requests`
- `bookings`
- `payments`
- `upsell_offers`

## 11.4 AI / logging entities
- `intent_logs`
- `tool_calls`
- `ai_drafts`
- `handoffs`
- `feedback_labels`

## 11.5 Analytics entities
- `events`
- `csat_scores`
- `conversion_metrics`

---

## 12. Tool architecture

All operational actions must be defined as typed tools.

### Minimum tool set
- `get_hotel_policy`
- `search_kb`
- `check_availability`
- `get_live_price`
- `create_lead`
- `create_booking_request`
- `send_payment_link`
- `create_handoff`
- `create_complaint_ticket`
- `notify_staff`

### Tool design rules
- every tool has validated input schema;
- every tool has typed output schema;
- every tool requires `hotel_id`;
- side effects are logged;
- failures return structured errors.

---

## 13. Automation boundaries

## Good candidates for automation
- FAQ
- lead qualification
- follow-up reminders
- contact capture
- handoff creation
- payment reminders
- post-stay follow-ups

## Keep human review for longer
- discounts
- refunds
- overbooking
- complaint resolution
- special arrangements
- manual upgrades
- long group negotiations

---

## 14. n8n responsibilities

Use n8n for automations, not as the core app.

### Good uses
- Telegram webhook ingestion
- follow-up flows
- staff alerts
- complaint escalation
- CRM sync
- daily summaries
- retry logic for outbound messaging

### Do not place here permanently
- core tenant authorization logic
- central booking business rules
- persistent app state ownership
- complex dashboard logic
- foundational domain model

---

## 15. Risks and mitigation

### Risk: hallucinated pricing / availability
Mitigation:
- tool-only transactional data;
- structured source of truth.

### Risk: weak hotel content quality
Mitigation:
- document curation workflow;
- knowledge ownership;
- structured FAQ first.

### Risk: premature automation
Mitigation:
- phased rollout;
- confidence thresholds;
- staff approval.

### Risk: low explainability
Mitigation:
- log retrieval evidence;
- log intent;
- log tool inputs/outputs;
- store human overrides.

### Risk: multi-tenant leakage
Mitigation:
- mandatory `hotel_id` scoping everywhere;
- row-level security;
- tenant-specific retrieval filters.

---

## 16. MVP definition

## MVP v1 — AI Copilot
- one hotel
- Telegram only
- knowledge base
- AI suggested replies
- human approval before send
- conversation inbox
- basic analytics

## MVP v2 — Semi-automated concierge
- auto-answer FAQ
- handoff rules
- lead capture
- multilingual support
- improved analytics
- simple automations

## MVP v3 — Booking assistant
- availability lookup
- room recommendation
- pre-booking
- payment link flow
- booking status tracking

---

## 17. Required user flows

### Flow 1 — FAQ
Guest asks a standard question and gets an immediate answer from KB.

### Flow 2 — Room discovery
Guest provides dates and preferences; assistant collects required parameters and proposes options.

### Flow 3 — Lead capture
Guest asks about pricing; assistant gathers enough information and creates a lead.

### Flow 4 — Complaint
Assistant responds empathetically, creates an urgent handoff, and alerts staff.

### Flow 5 — Booking
Assistant gathers parameters, checks availability, creates a request, and sends a payment or reservation flow.

---

## 18. Implementation roadmap

### Sprint 0 — Discovery
- define 20–30 conversation scenarios
- collect policies, room data, FAQs
- define tone of voice
- confirm integrations
- define escalation policies

### Sprint 1 — Foundations
- repo setup
- auth
- tenant model
- Telegram webhook
- message persistence
- dashboard shell

### Sprint 2 — Knowledge and inbox
- KB upload
- chunking/indexing
- retrieval
- conversation view
- suggested replies

### Sprint 3 — Copilot
- intent classification
- AI drafts
- manager send flow
- logging and analytics

### Sprint 4 — Semi-automation
- FAQ auto-answer
- handoff rules
- lead capture
- follow-ups

### Sprint 5 — Transaction layer
- availability tools
- live pricing
- booking request flow
- payment link flow

### Sprint 6 — Hardening
- metrics
- confidence thresholds
- audit logs
- role-based access
- tenant isolation review

---

## 19. Architecture decision summary

### Start with:
- Next.js
- TypeScript
- Supabase
- pgvector
- OpenAI
- n8n
- Telegram Bot API

### Avoid:
- fully autonomous booking from day one;
- business-critical logic hidden inside ad hoc workflows;
- freeform answers for live transactional data;
- weak tenant scoping.

---

## 20. Final guidance

The correct path is:
1. assistant for staff;
2. automation for FAQ and lead capture;
3. transaction-safe booking support;
4. multi-tenant productization.

That path gives the fastest route to value while protecting hotel operations and guest trust.
