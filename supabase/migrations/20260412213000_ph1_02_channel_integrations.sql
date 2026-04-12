create table if not exists public.channel_integrations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  channel text not null check (channel in ('telegram')),
  name text not null,
  bot_token_encrypted text not null,
  bot_username text null,
  webhook_secret text null,
  webhook_path_token text not null unique,
  is_active boolean not null default true,
  last_verified_at timestamptz null,
  last_error_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  created_by_hotel_user_id uuid null references public.hotel_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_channel_integrations_hotel_channel_active
  on public.channel_integrations(hotel_id, channel, is_active);
create index if not exists idx_channel_integrations_webhook_path_token
  on public.channel_integrations(webhook_path_token);
create unique index if not exists uq_channel_integrations_one_active_per_hotel_channel
  on public.channel_integrations(hotel_id, channel)
  where is_active = true;

drop trigger if exists set_channel_integrations_updated_at on public.channel_integrations;
create trigger set_channel_integrations_updated_at
before update on public.channel_integrations
for each row
execute function public.set_updated_at();

alter table public.channel_integrations enable row level security;

drop policy if exists "hotel_admins_can_read_same_hotel_channel_integrations" on public.channel_integrations;
create policy "hotel_admins_can_read_same_hotel_channel_integrations"
on public.channel_integrations
for select
to authenticated
using (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_admins_can_insert_same_hotel_channel_integrations" on public.channel_integrations;
create policy "hotel_admins_can_insert_same_hotel_channel_integrations"
on public.channel_integrations
for insert
to authenticated
with check (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_admins_can_update_same_hotel_channel_integrations" on public.channel_integrations;
create policy "hotel_admins_can_update_same_hotel_channel_integrations"
on public.channel_integrations
for update
to authenticated
using (public.is_hotel_admin_for_hotel(hotel_id))
with check (public.is_hotel_admin_for_hotel(hotel_id));

comment on table public.channel_integrations is
  'Hotel-scoped live channel integrations, including the Phase 1 Telegram bot configuration.';
