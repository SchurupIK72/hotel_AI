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

comment on function public.is_hotel_admin_for_hotel(uuid) is
  'Returns whether the current authenticated user is an active hotel_admin for the target hotel.';
