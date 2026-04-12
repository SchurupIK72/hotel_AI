create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  default_language text null,
  timezone text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hotel_users (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('hotel_admin', 'manager')),
  full_name text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, auth_user_id)
);

create index if not exists idx_hotels_slug on public.hotels(slug);
create index if not exists idx_hotel_users_auth_user_id on public.hotel_users(auth_user_id);
create index if not exists idx_hotel_users_hotel_role on public.hotel_users(hotel_id, role);

drop trigger if exists set_hotels_updated_at on public.hotels;
create trigger set_hotels_updated_at
before update on public.hotels
for each row
execute function public.set_updated_at();

drop trigger if exists set_hotel_users_updated_at on public.hotel_users;
create trigger set_hotel_users_updated_at
before update on public.hotel_users
for each row
execute function public.set_updated_at();

create or replace function public.is_hotel_admin_for_hotel(target_hotel_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = target_hotel_id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
      and hotel_users.role = 'hotel_admin'
  );
$$;

revoke all on function public.is_hotel_admin_for_hotel(uuid) from public;
grant execute on function public.is_hotel_admin_for_hotel(uuid) to authenticated;

alter table public.hotels enable row level security;
alter table public.hotel_users enable row level security;

drop policy if exists "hotel_users_can_read_their_hotel" on public.hotels;
create policy "hotel_users_can_read_their_hotel"
on public.hotels
for select
to authenticated
using (
  exists (
    select 1
    from public.hotel_users
    where hotel_users.hotel_id = hotels.id
      and hotel_users.auth_user_id = auth.uid()
      and hotel_users.is_active = true
  )
);

drop policy if exists "hotel_users_can_read_own_membership" on public.hotel_users;
drop policy if exists "hotel_users_can_read_their_membership_or_admin_view" on public.hotel_users;
drop policy if exists "hotel_users_can_read_own_membership_or_admin_same_hotel" on public.hotel_users;
create policy "hotel_users_can_read_own_membership_or_admin_same_hotel"
on public.hotel_users
for select
to authenticated
using (
  hotel_users.auth_user_id = auth.uid()
  or public.is_hotel_admin_for_hotel(hotel_users.hotel_id)
);

comment on table public.hotels is 'Tenant root entity for hotel-scoped data.';
comment on table public.hotel_users is 'Maps authenticated staff users to hotel-scoped roles.';
comment on function public.is_hotel_admin_for_hotel(uuid) is
  'Returns whether the current authenticated user is an active hotel_admin for the target hotel.';
