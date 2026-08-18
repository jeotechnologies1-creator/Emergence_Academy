-- Do not read public.profiles from a profiles RLS policy, even through a
-- helper function. PostgreSQL can evaluate nested policies before a legacy
-- SECURITY DEFINER helper takes effect, producing error 42P17. The JWT's
-- app_metadata is trusted (unlike user_metadata) and is safe inside RLS.

-- Backfill each existing login with its database role. A new session is
-- required after this update so the browser receives the revised JWT claim.
update auth.users as u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role::text)
from public.profiles as p
where p.id = u.id
  and coalesce(u.raw_app_meta_data ->> 'role', '') is distinct from p.role::text;

create or replace function public.current_user_role()
returns text
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select lower(trim(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    ''
  )));
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;
