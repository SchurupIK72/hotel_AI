create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  channel text not null check (channel in ('telegram')),
  external_user_id text not null,
  telegram_username text null,
  display_name text null,
  first_name text null,
  last_name text null,
  language_code text null,
  last_message_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, channel, external_user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  channel text not null check (channel in ('telegram')),
  status text not null check (status in ('new', 'open', 'pending', 'closed')) default 'new',
  mode text not null check (mode in ('copilot_mode', 'human_handoff_mode')) default 'copilot_mode',
  assigned_hotel_user_id uuid null references public.hotel_users(id) on delete set null,
  subject text null,
  last_message_preview text null,
  last_message_at timestamptz not null default now(),
  last_inbound_message_at timestamptz null,
  unread_count integer not null default 0,
  last_ai_draft_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  guest_id uuid null references public.guests(id) on delete set null,
  channel text not null check (channel in ('telegram')),
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null check (message_type in ('text')),
  external_message_id text not null,
  external_chat_id text not null,
  sender_external_id text null,
  text_body text not null,
  source_draft_id uuid null,
  delivered_at timestamptz null,
  raw_payload jsonb null,
  created_at timestamptz not null default now(),
  unique (hotel_id, channel, direction, external_message_id)
);

create index if not exists idx_guests_hotel_channel_external_user
  on public.guests(hotel_id, channel, external_user_id);
create index if not exists idx_conversations_hotel_guest_status_last_message
  on public.conversations(hotel_id, guest_id, status, last_message_at desc);
create index if not exists idx_messages_hotel_conversation_created_at
  on public.messages(hotel_id, conversation_id, created_at);
create index if not exists idx_messages_hotel_channel_direction_external_message
  on public.messages(hotel_id, channel, direction, external_message_id);

drop trigger if exists set_guests_updated_at on public.guests;
create trigger set_guests_updated_at
before update on public.guests
for each row
execute function public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

alter table public.guests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "hotel_users_can_read_same_hotel_guests" on public.guests;
create policy "hotel_users_can_read_same_hotel_guests"
on public.guests
for select
to authenticated
using (
  exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = guests.hotel_id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
  )
);

drop policy if exists "hotel_admins_can_insert_same_hotel_guests" on public.guests;
create policy "hotel_admins_can_insert_same_hotel_guests"
on public.guests
for insert
to authenticated
with check (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_admins_can_update_same_hotel_guests" on public.guests;
create policy "hotel_admins_can_update_same_hotel_guests"
on public.guests
for update
to authenticated
using (public.is_hotel_admin_for_hotel(hotel_id))
with check (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_users_can_read_same_hotel_conversations" on public.conversations;
create policy "hotel_users_can_read_same_hotel_conversations"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = conversations.hotel_id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
  )
);

drop policy if exists "hotel_admins_can_insert_same_hotel_conversations" on public.conversations;
create policy "hotel_admins_can_insert_same_hotel_conversations"
on public.conversations
for insert
to authenticated
with check (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_admins_can_update_same_hotel_conversations" on public.conversations;
create policy "hotel_admins_can_update_same_hotel_conversations"
on public.conversations
for update
to authenticated
using (public.is_hotel_admin_for_hotel(hotel_id))
with check (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_users_can_read_same_hotel_messages" on public.messages;
create policy "hotel_users_can_read_same_hotel_messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = messages.hotel_id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
  )
);

drop policy if exists "hotel_admins_can_insert_same_hotel_messages" on public.messages;
create policy "hotel_admins_can_insert_same_hotel_messages"
on public.messages
for insert
to authenticated
with check (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_admins_can_update_same_hotel_messages" on public.messages;
create policy "hotel_admins_can_update_same_hotel_messages"
on public.messages
for update
to authenticated
using (public.is_hotel_admin_for_hotel(hotel_id))
with check (public.is_hotel_admin_for_hotel(hotel_id));

comment on table public.guests is
  'Guest identities resolved from inbound channels, scoped to one hotel.';
comment on table public.conversations is
  'Guest conversation threads used by the inbox and Copilot features.';
comment on table public.messages is
  'Normalized inbound and outbound guest communication records.';
