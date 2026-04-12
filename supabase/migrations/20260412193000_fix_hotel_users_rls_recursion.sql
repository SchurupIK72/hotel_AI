drop policy if exists "hotel_users_can_read_their_membership_or_admin_view" on public.hotel_users;
drop policy if exists "hotel_users_can_read_own_membership" on public.hotel_users;

create policy "hotel_users_can_read_own_membership"
on public.hotel_users
for select
to authenticated
using (
  hotel_users.auth_user_id = auth.uid()
);
