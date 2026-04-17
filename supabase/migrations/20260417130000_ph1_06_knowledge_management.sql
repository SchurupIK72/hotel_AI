create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  question text not null,
  answer text not null,
  is_published boolean not null default false,
  published_at timestamptz null,
  created_by_hotel_user_id uuid not null references public.hotel_users(id) on delete restrict,
  updated_by_hotel_user_id uuid not null references public.hotel_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  title text not null,
  body text not null,
  is_published boolean not null default false,
  published_at timestamptz null,
  created_by_hotel_user_id uuid not null references public.hotel_users(id) on delete restrict,
  updated_by_hotel_user_id uuid not null references public.hotel_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_faq_items_hotel_published_updated
  on public.faq_items(hotel_id, is_published, updated_at desc);
create index if not exists idx_policy_items_hotel_published_updated
  on public.policy_items(hotel_id, is_published, updated_at desc);

drop trigger if exists set_faq_items_updated_at on public.faq_items;
create trigger set_faq_items_updated_at
before update on public.faq_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_policy_items_updated_at on public.policy_items;
create trigger set_policy_items_updated_at
before update on public.policy_items
for each row
execute function public.set_updated_at();

alter table public.faq_items enable row level security;
alter table public.policy_items enable row level security;

drop policy if exists "hotel_users_can_read_same_hotel_faq_items" on public.faq_items;
create policy "hotel_users_can_read_same_hotel_faq_items"
on public.faq_items
for select
to authenticated
using (
  exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = faq_items.hotel_id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
  )
);

drop policy if exists "hotel_admins_can_manage_same_hotel_faq_items" on public.faq_items;
create policy "hotel_admins_can_manage_same_hotel_faq_items"
on public.faq_items
for all
to authenticated
using (public.is_hotel_admin_for_hotel(hotel_id))
with check (public.is_hotel_admin_for_hotel(hotel_id));

drop policy if exists "hotel_users_can_read_same_hotel_policy_items" on public.policy_items;
create policy "hotel_users_can_read_same_hotel_policy_items"
on public.policy_items
for select
to authenticated
using (
  exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = policy_items.hotel_id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
  )
);

drop policy if exists "hotel_admins_can_manage_same_hotel_policy_items" on public.policy_items;
create policy "hotel_admins_can_manage_same_hotel_policy_items"
on public.policy_items
for all
to authenticated
using (public.is_hotel_admin_for_hotel(hotel_id))
with check (public.is_hotel_admin_for_hotel(hotel_id));

comment on table public.faq_items is
  'Hotel-scoped curated FAQ records used as approved knowledge for later Copilot retrieval.';
comment on table public.policy_items is
  'Hotel-scoped curated policy records used as approved knowledge for later Copilot retrieval.';
