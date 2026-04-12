# readme.md

# AI Hotel Manager

AI Hotel Manager is a phased product for hotels that starts as an **AI copilot for staff** and evolves into an **AI concierge and booking assistant**.

The system is designed for:
- 24/7 guest communication;
- multilingual guest support;
- reduced staff workload;
- faster lead capture;
- safer booking automation.

The project is intentionally structured to avoid the main failure mode of hospitality AI systems: **invented answers about availability, pricing, and booking status**.

---

## Product vision

The long-term vision is an AI manager that can:
- answer guest questions;
- qualify booking intent;
- recommend rooms;
- support bookings;
- escalate exceptions to humans;
- operate across channels.

But the implementation must happen in phases.

---

## Delivery phases

### 1. AI Copilot
The assistant suggests replies for hotel managers.  
Managers approve, edit, and send them.

### 2. Semi-automated concierge
The assistant answers standard FAQ automatically and escalates more complex issues.

### 3. Booking assistant
The assistant can check availability via tools, collect booking details, create booking requests, and support payment flows.

### 4. Multi-tenant SaaS
The product supports multiple hotels, tenant isolation, billing, and team roles.

---

## Core principles

- **Human-in-the-loop first**
- **Tool-based transactional actions**
- **Structured knowledge + RAG**
- **Multi-tenant from the beginning**
- **Full logging and observability**
- **Phased rollout over big-bang automation**

---

## Recommended stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS

### Backend / platform
- Supabase
  - Postgres
  - Auth
  - Storage
  - Realtime
  - Edge Functions

### AI
- OpenAI API

### Automation
- n8n

### Messaging
- Telegram Bot API first
- Web chat second

### Observability
- PostHog
- Sentry

---

## Project goals

### Business goals
- reduce manager workload;
- improve response speed;
- increase lead conversion;
- increase booking conversion;
- preserve service quality.

### Technical goals
- strong tenant isolation;
- typed tool-based orchestration;
- scalable conversation state;
- clear knowledge ingestion pipeline;
- reliable audit trails.

---

## Repository structure

```text
.
├── app/                      # Next.js app router
├── components/               # UI components
├── lib/                      # shared libraries
│   ├── ai/                   # orchestrator, prompts, policies
│   ├── auth/                 # auth and tenant helpers
│   ├── db/                   # database access
│   ├── kb/                   # knowledge ingestion and retrieval
│   ├── messaging/            # Telegram / web adapters
│   ├── tools/                # typed operational tools
│   ├── analytics/            # event tracking
│   └── guards/               # safety and validation
├── skills/                   # Codex Skills and reusable project workflows
├── supabase/                 # migrations, functions, seeds
├── workflows/                # n8n exports / workflow docs
├── docs/                     # architecture and product docs
└── tests/                    # unit, integration, e2e
```

---

## Suggested app modules

### 1. Inbox
Used by hotel staff to manage conversations and review AI replies.

### 2. Knowledge Base
Used to manage FAQs, policies, room details, and retrieval quality.

### 3. Leads / Booking Requests
Tracks inquiry-to-booking progression.

### 4. Analytics
Shows automation rate, response time, conversion, and missed intents.

### 5. Settings
Tenant configuration, channels, tone, supported languages, roles, and integrations.

---

## First milestone: MVP v1

Ship the smallest useful version.

### Scope
- single hotel;
- Telegram only;
- message persistence;
- AI-generated suggested replies;
- human approval workflow;
- KB-backed answer assistance;
- simple analytics.

### Not in scope yet
- autonomous booking;
- live availability without tool integration;
- complex billing;
- multi-tenant self-serve onboarding.

---

## Second milestone: MVP v2

### Scope
- FAQ auto-replies;
- handoff rules;
- lead capture;
- multilingual support;
- manager notifications;
- follow-up automations.

---

## Third milestone: MVP v3

### Scope
- availability checks;
- structured room recommendations;
- booking request creation;
- payment link flow;
- booking state tracking.

---

## User flows to support first

### FAQ
User asks a standard operational question.  
The assistant answers from approved knowledge.

### Room inquiry
User asks for a room for certain dates.  
The assistant gathers parameters and prepares options.

### Lead capture
User asks about pricing.  
The assistant captures enough structured information to create a lead.

### Complaint
The assistant responds safely and hands off to staff.

### Booking progression
The assistant uses tools for availability, pricing, and booking request creation.

---

## Safety boundaries

### Informational
Can answer from KB:
- check-in rules;
- amenities;
- hotel services;
- location info.

### Transactional
Must use tools:
- availability;
- live price;
- booking state;
- payment links.

### Sensitive
Must hand off or require approval:
- refunds;
- complaints;
- policy exceptions;
- VIP cases;
- disputed charges.

---

## Minimum database entities

### Core
- hotels
- hotel_users
- guests
- conversations
- messages

### Knowledge
- knowledge_sources
- knowledge_documents
- knowledge_chunks
- faq_items
- policies

### Operations
- room_types
- rate_plans
- booking_requests
- bookings
- payments

### AI / audit
- intent_logs
- tool_calls
- ai_drafts
- handoffs

---

## Development workflow

1. define the scenario and acceptance criteria;
2. define or update the typed contracts;
3. implement domain logic in app code;
4. expose operational logic via tools;
5. connect to orchestration layer;
6. cover with tests;
7. observe logs and refine prompts or rules.

---

## Definition of done

A feature is done only if:
- the user flow works end to end;
- tenant scoping is enforced;
- logs are emitted;
- typed contracts exist;
- tests cover the key path;
- failure and handoff behavior is defined.

---

## Metrics to track

### Product metrics
- reply acceptance rate;
- automation rate;
- handoff rate;
- average response time;
- lead conversion;
- booking conversion.

### Quality metrics
- confidence distribution;
- hallucination incidents;
- missing KB coverage;
- manual overrides;
- complaint handling latency.

---

## Local setup guidance

This repository is intended for a real product, but an implementation should conceptually follow this setup:

1. create Supabase project;
2. configure env vars;
3. create Telegram bot;
4. connect OpenAI API;
5. run migrations;
6. upload seed KB;
7. run dashboard and webhook endpoints;
8. test inbox + suggested replies.

---

## Codex skills

Custom repo-local Codex skills live in `.codex/skills`.

To install or refresh them in the global Codex runtime directory, use [docs/codex-local-skills.md](/c:/REPO/hotelAI/docs/codex-local-skills.md).

---

## Environment variables

Example categories:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `POSTHOG_KEY`
- `SENTRY_DSN`

Do not hardcode secrets.

---

## Team guidance

The project should be built for reliability, not demo magic.

Priorities:
1. correct architecture;
2. strong data boundaries;
3. good logs;
4. safe automation;
5. only then more autonomy.

---

## Final note

The best version of this product is not “a chatbot that talks a lot.”  
It is **a controlled hotel operations assistant** that:
- retrieves trusted knowledge,
- acts only through tools,
- involves humans when needed,
- and gradually earns the right to automate more.
