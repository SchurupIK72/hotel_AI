create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid null references public.hotels(id) on delete set null,
  integration_id uuid null references public.channel_integrations(id) on delete set null,
  event_type text not null,
  entity_type text null,
  entity_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_logs_hotel_event_created
  on public.event_logs(hotel_id, event_type, created_at desc);
create index if not exists idx_event_logs_integration_created
  on public.event_logs(integration_id, created_at desc);

alter table public.event_logs enable row level security;

drop policy if exists "hotel_users_can_read_same_hotel_event_logs" on public.event_logs;
create policy "hotel_users_can_read_same_hotel_event_logs"
on public.event_logs
for select
to authenticated
using (
  event_logs.hotel_id is not null
  and exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = event_logs.hotel_id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
  )
);

comment on table public.event_logs is
  'Structured hotel-scoped operational events used for ingress, Copilot, and delivery observability.';
