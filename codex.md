# codex.md

# Codex Instructions for AI Hotel Manager

This file defines how Codex should work in this repository.

The project is a phased hospitality AI system. Codex must optimize for:
- correctness;
- multi-tenant safety;
- maintainability;
- typed integrations;
- safe automation;
- reuse through Skills.

Do not optimize for flashy demos at the expense of system safety.

---

## 1. Primary mission

Codex should help build a hotel AI manager that:
- starts as a copilot for human staff;
- becomes a semi-automated concierge;
- later supports tool-backed booking workflows.

The codebase must always preserve the distinction between:
- informational responses,
- transactional actions,
- sensitive / escalated situations.

---

## 2. Mandatory product assumptions

Codex must assume the following are true unless explicitly changed by maintainers:

1. **Human-in-the-loop comes first**
2. **Live booking data is never generated freeform**
3. **Every operational action goes through a typed tool**
4. **Every tenant is isolated by `hotel_id`**
5. **Knowledge uses structured data plus RAG**
6. **Observability is a first-class requirement**
7. **The implementation is phased, not big-bang**

Codex should reject design drift that violates these assumptions.

---

## 3. Skills are required

This repository uses **Skills**.  
Codex should prefer reusable, explicit, named Skills over ad hoc hidden logic.

### Skill usage rules
- use Skills for recurring workflows;
- keep Skills small, composable, and named by responsibility;
- do not bury critical domain rules inside prompts when they should exist in code or Skills;
- use Skills to standardize patterns across ingestion, orchestration, tools, and messaging.

### Example Skills we expect
- `rag-retrieval-skill`
- `intent-routing-skill`
- `reply-drafting-skill`
- `handoff-skill`
- `booking-request-skill`
- `knowledge-ingestion-skill`
- `tenant-guard-skill`
- `telemetry-skill`

If the repo contains an existing Skill for a task, Codex should use or extend it before creating a new pattern.

---

## 4. Architecture boundaries Codex must preserve

### 4.1 Channel adapters
Responsible only for:
- receiving inbound events;
- normalizing messages;
- sending outbound messages;
- transport-specific formatting.

They should not contain:
- business logic;
- pricing logic;
- tenant authorization policy;
- retrieval orchestration;
- booking decisions.

### 4.2 AI orchestrator
Responsible for:
- intent classification;
- entity extraction;
- mode / state transition;
- retrieval requests;
- tool selection;
- reply drafting;
- escalation decisions.

It should not:
- bypass tools for transactional truth;
- directly own transport details;
- contain hardcoded tenant-specific content.

### 4.3 Tools
Responsible for side-effecting actions and truth retrieval:
- availability;
- pricing;
- booking request creation;
- payment link generation;
- staff notifications;
- handoff creation.

Tools must be:
- typed;
- validated;
- logged;
- scoped by `hotel_id`.

### 4.4 Knowledge layer
Responsible for:
- ingestion;
- chunking;
- indexing;
- retrieval;
- structured hotel metadata.

It must separate:
- structured truth;
- unstructured help content.

### 4.5 Dashboard
Responsible for:
- human oversight;
- inbox;
- knowledge administration;
- analytics;
- approvals and overrides.

---

## 5. Response classes are strict

Codex must enforce these categories in code and architecture.

### Informational
Examples:
- check-in time
- parking
- breakfast
- pet policy
- hotel amenities
- local recommendations from curated content

Implementation guidance:
- may use KB / RAG
- should cite retrieved evidence internally where possible
- should not require a tool if no live transactional data is involved

### Transactional
Examples:
- live room availability
- live price
- create booking request
- booking status
- send payment link
- modify booking

Implementation guidance:
- always use tool calls
- never answer from model memory
- must validate required fields before tool execution

### Sensitive
Examples:
- complaint
- refund
- compensation
- VIP handling
- exception to policy
- abuse / unsafe content
- legal issue

Implementation guidance:
- route to handoff
- prepare structured case summary
- log rationale for escalation

---

## 6. Coding standards

### Languages
- default to **TypeScript**
- keep edge / backend code typed
- minimize untyped `any`

### Structure
- prefer small modules
- separate domain logic from transport and UI
- isolate prompt templates from business rules
- keep schemas near tools or domain contracts

### Validation
- use schemas for tool inputs and outputs
- validate external payloads at boundaries
- fail with structured errors

### Naming
- name modules by domain responsibility
- use explicit suffixes like:
  - `*.tool.ts`
  - `*.skill.ts`
  - `*.schema.ts`
  - `*.service.ts`
  - `*.adapter.ts`

### Tests
Every meaningful feature should include:
- unit tests for pure logic
- integration tests for tools / orchestration
- happy path and failure path coverage

---

## 7. Tenant safety rules

This is a multi-tenant codebase even when MVP starts with one hotel.

Codex must ensure:
- `hotel_id` is present in relevant DB records;
- reads are tenant-scoped;
- retrieval filters by tenant;
- tool calls require tenant context;
- logs preserve tenant attribution;
- no cross-tenant caching leaks.

### Forbidden
- global retrieval without tenant filter
- shared mutable state across tenants without isolation
- direct SQL or data access that omits tenant boundaries
- hardcoded tenant assumptions in reusable modules

---

## 8. Tool design rules

Every tool should have:
1. clear purpose
2. input schema
3. output schema
4. tenant scoping
5. logging
6. deterministic error handling

### Example tool set
- `searchKb`
- `getHotelPolicy`
- `checkAvailability`
- `getLivePrice`
- `createLead`
- `createBookingRequest`
- `sendPaymentLink`
- `createHandoff`
- `notifyStaff`

### Tool implementation rules
- side effects must be explicit;
- do not hide side effects in helper functions;
- log request + result metadata;
- return machine-usable outputs, not only prose.

---

## 9. RAG and knowledge rules

Codex should treat RAG as infrastructure, not magic.

### Always separate
- structured hotel truths;
- document-based knowledge;
- live transactional truth.

### Ingestion requirements
- track source metadata;
- version content when possible;
- chunk consistently;
- support re-indexing;
- mark stale content.

### Retrieval requirements
- filter by tenant;
- prefer structured truth when available;
- avoid answering beyond retrieved evidence for informational questions;
- do not use retrieval as a substitute for live operational tools.

---

## 10. Conversation and state rules

The assistant is stateful. Codex should model conversation state explicitly.

### Required modes
- `faq_mode`
- `lead_capture_mode`
- `room_selection_mode`
- `booking_mode`
- `payment_pending_mode`
- `human_handoff_mode`
- `post_booking_support_mode`

### State handling requirements
- state transitions must be explicit;
- extracted entities should be persisted where appropriate;
- missing required fields must be represented, not guessed;
- low confidence should degrade into clarification or handoff, not invention.

---

## 11. n8n usage policy

Codex may integrate with n8n, but must not move the product core into workflow spaghetti.

### Use n8n for
- event-driven automations
- notifications
- reminders
- sync jobs
- follow-ups
- staff alerts

### Keep in app code
- tenant model
- domain invariants
- booking logic
- orchestrator contracts
- dashboard logic
- authorization rules

When Codex proposes an automation, it should ask:
- is this operational glue?
- or is this core product behavior?

If it is core behavior, keep it in the app.

---

## 12. Observability requirements

Codex should add logs and telemetry for:
- intent detection;
- retrieval events;
- selected chunks or source refs;
- tool choice;
- tool inputs / outputs metadata;
- final response mode;
- handoff rationale;
- human overrides;
- failures and retries.

Do not add noisy logs without purpose.  
Favor structured events over ad hoc strings.

---

## 13. Prompting policy

Prompts are important, but prompts are not the system.

Codex should:
- keep prompts versioned;
- separate prompts from tool code;
- avoid putting hard business constraints only in prompts;
- enforce critical constraints in code, schemas, and routing.

### Bad pattern
“Trust the model to never invent price.”

### Good pattern
Require `getLivePrice` tool and block final pricing answers without tool output.

---

## 14. UI and dashboard guidance

Codex should keep the dashboard practical.

### Inbox
- fast scanning
- confidence display
- handoff controls
- suggested replies
- guest context

### Knowledge
- document source visibility
- edit / publish status
- reindex controls

### Leads / bookings
- clear stages
- channel origin
- assigned staff
- structured details

### Analytics
- operational usefulness over vanity charts

---

## 15. Performance and scaling guidance

Optimize for:
- correctness first;
- then latency;
- then cost.

### Acceptable tradeoffs
- slightly slower but safer transactional flow;
- staff approval for ambiguous cases;
- explicit retries instead of silent failure.

### Avoid
- premature microservices;
- over-abstracted orchestration;
- cross-cutting hidden state.

---

## 16. Anti-patterns Codex must avoid

Do not:
- build fully autonomous booking first;
- put tenant-specific constants in shared modules;
- answer live transactional questions without tools;
- skip validation because “the model understands it”;
- bury business-critical rules inside long prompts only;
- overuse n8n for core domain behavior;
- create giant god-modules for orchestration;
- mix UI concerns with channel adapter code;
- add unbounded silent retries.

---

## 17. Preferred implementation order

When asked to build features, Codex should prefer this sequence:

1. schemas and contracts
2. tenant-safe data model
3. tool implementation
4. orchestrator integration
5. UI / dashboard integration
6. analytics and logging
7. tests
8. polish

For new product areas, follow this order:
1. copilot
2. semi-automation
3. booking support
4. broader SaaS concerns

---

## 18. Definition of done for Codex tasks

Codex should consider a task complete only when:
- architecture boundaries are respected;
- tenant scope is enforced;
- schemas are defined;
- operational paths use tools;
- logs are emitted;
- tests cover core behavior;
- failure mode is explicit;
- the implementation fits the phased roadmap.

---

## 19. How Codex should respond to ambiguous requests

If a user asks for a feature that could violate the architecture:
- prefer the safer phased version;
- preserve human approval for risky flows;
- note the required future extension points;
- do not skip straight to risky autonomy.

Example:
If asked to “make the AI book rooms automatically,” Codex should first implement:
- parameter collection;
- availability tool;
- booking request creation;
- optional approval gate.

Only then extend to full autonomous flow if explicitly supported by business constraints.

---

## 20. Final instruction

Codex should act like an engineer on a real hospitality operations product:
- careful with trust,
- strict with data boundaries,
- explicit with tools,
- disciplined about Skills,
- and always aware that a wrong answer can affect real guests and real bookings.
