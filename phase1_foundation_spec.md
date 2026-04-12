    # Phase 1 — ТЗ (Foundation) for AI Hotel Manager

## Цель
Собрать базовую систему: Telegram → Backend → DB → Dashboard → Ответ менеджера.

## Scope
- Telegram webhook
- conversations/messages
- dashboard inbox
- manual reply
- tenant isolation

## User flows
1. Гость пишет → создаётся guest + conversation + message
2. Менеджер видит inbox
3. Менеджер отвечает → сообщение уходит в Telegram

## БД (ключевые таблицы)
- hotels
- hotel_users
- guests
- conversations
- messages
- event_logs

## API
- POST /api/webhooks/telegram/[integrationId]
- GET /api/conversations
- GET /api/conversations/:id
- POST /api/conversations/:id/reply
- POST /api/conversations/:id/assign
- POST /api/conversations/:id/status

## Acceptance
- сообщения доходят
- ответы отправляются
- данные изолированы по hotel_id

## Backlog (основное)
- DB schema
- Telegram integration
- inbox UI
- conversation UI
- reply flow
