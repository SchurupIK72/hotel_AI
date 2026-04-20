alter table public.messages
  add column if not exists sent_by_hotel_user_id uuid null references public.hotel_users(id) on delete set null,
  add column if not exists delivery_status text null check (
    delivery_status in ('sending', 'sent', 'failed_retryable', 'failed_ambiguous')
  ),
  add column if not exists send_operation_key uuid null;

update public.messages
set delivery_status = 'sent'
where direction = 'outbound'
  and delivery_status is null;

create unique index if not exists uq_messages_hotel_send_operation_key
  on public.messages(hotel_id, send_operation_key)
  where send_operation_key is not null;

comment on column public.messages.sent_by_hotel_user_id is
  'Hotel staff user who initiated the outbound reply attempt.';

comment on column public.messages.delivery_status is
  'Outbound delivery lifecycle status. Null for legacy or inbound rows.';

comment on column public.messages.send_operation_key is
  'Idempotency key for one explicit outbound send action.';
