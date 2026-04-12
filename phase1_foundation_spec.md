# Phase 1 - AI Copilot Foundation Summary

## Goal

Ship the first useful version of the product for one hotel:

- Telegram guest messaging;
- dashboard inbox and conversation view;
- KB-backed AI reply drafts;
- human approval before send;
- basic logging and tenant-safe foundations.

Phase 1 is the AI Copilot release, not an infra-only milestone.

## Scope

- Telegram webhook and outbound messaging;
- guests, conversations, messages, and event logs;
- inbox UI and conversation detail UI;
- minimal hotel knowledge base for approved informational content;
- AI-generated suggested replies;
- draft regeneration and manual editing before send;
- audit trail for generated drafts and final replies;
- tenant-safe contracts and RLS-ready data model.

## Out of Scope

- autonomous replies;
- FAQ auto-answering;
- live availability and pricing;
- booking creation or payment flows;
- web chat, WhatsApp, and other channels;
- full self-serve SaaS onboarding.

## Required Flows

1. Guest sends a Telegram message -> guest, conversation, and message are created or resolved.
2. Manager opens the inbox -> sees only hotel-scoped conversations.
3. System generates 1-3 reply drafts using approved hotel knowledge for informational questions.
4. Manager edits or approves a draft -> final text is sent to Telegram.
5. Draft generation, selection, and send outcome are logged.

## Acceptance

- AI drafts exist in Phase 1.
- Human approval is required before every outbound reply.
- Informational questions can use approved KB content.
- Transactional questions do not return invented live data.
- Complaint and policy-exception cases fall back safely.
- Tenant isolation is preserved throughout the flow.

## Reference

Full decision-complete specification: [phase1_foundation_spec_full.md](/c:/REPO/hotelAI/phase1_foundation_spec_full.md)
