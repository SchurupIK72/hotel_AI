insert into public.hotels (
  id,
  name,
  slug,
  default_language,
  timezone
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Demo Hotel',
  'demo-hotel',
  'en',
  'Europe/Moscow'
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  default_language = excluded.default_language,
  timezone = excluded.timezone,
  updated_at = now();

-- Demo staff users are created through the Auth admin API because they must be
-- valid Supabase Auth accounts. Run `npm run demo:bootstrap` after `supabase start`
-- and after you populate `.env.local` with local Supabase keys.
