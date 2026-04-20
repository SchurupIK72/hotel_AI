create table if not exists public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  draft_index integer not null check (draft_index between 1 and 3),
  draft_text text not null,
  source_type text not null check (source_type in ('kb', 'fallback', 'manual_trigger')),
  status text not null check (status in ('generated', 'selected', 'sent', 'discarded')) default 'generated',
  retrieval_refs jsonb null,
  model_name text null,
  confidence_label text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_drafts_hotel_conversation_created_at
  on public.ai_drafts(hotel_id, conversation_id, created_at desc);
create index if not exists idx_ai_drafts_hotel_conversation_generation
  on public.ai_drafts(hotel_id, conversation_id, generation_id, draft_index);
create index if not exists idx_ai_drafts_hotel_message_created_at
  on public.ai_drafts(hotel_id, message_id, created_at desc);

alter table public.ai_drafts enable row level security;

drop policy if exists "hotel_users_can_read_same_hotel_ai_drafts" on public.ai_drafts;
create policy "hotel_users_can_read_same_hotel_ai_drafts"
on public.ai_drafts
for select
to authenticated
using (
  exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = ai_drafts.hotel_id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
  )
);

drop policy if exists "hotel_admins_can_insert_same_hotel_ai_drafts" on public.ai_drafts;
create policy "hotel_admins_can_insert_same_hotel_ai_drafts"
on public.ai_drafts
for insert
to authenticated
with check (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_admins_can_update_same_hotel_ai_drafts" on public.ai_drafts;
create policy "hotel_admins_can_update_same_hotel_ai_drafts"
on public.ai_drafts
for update
to authenticated
using (public.is_hotel_admin_for_hotel(hotel_id))
with check (public.is_hotel_admin_for_hotel(hotel_id));

comment on table public.ai_drafts is
  'Tenant-scoped stored AI draft suggestions for one conversation and triggering inbound message.';
