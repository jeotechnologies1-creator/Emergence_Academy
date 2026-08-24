-- Office account passwords belong only in Supabase Auth (as hashes). The
-- profile flag is protected so an account owner cannot bypass the one-time
-- initial password replacement by changing the flag from the browser.
-- Keep this migration self-contained: some existing deployments may not have
-- run the earlier migration that first introduced this column.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create or replace function public.prevent_client_password_flag_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Do not use current_user here: this SECURITY DEFINER function runs as its
  -- owner. The JWT request role reliably identifies the service-role Edge
  -- Function that is allowed to change this protected flag.
  if old.must_change_password is distinct from new.must_change_password
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'must_change_password can only be changed by the password workflow';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_password_flag on public.profiles;
create trigger protect_profile_password_flag
  before update on public.profiles
  for each row execute function public.prevent_client_password_flag_change();

comment on column public.profiles.must_change_password is
  'Office account must replace the administrator-issued temporary password before using the dashboard.';
