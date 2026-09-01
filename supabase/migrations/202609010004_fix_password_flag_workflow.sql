-- The password-reset and first-login password-change flows need a protected
-- server-side way to toggle profiles.must_change_password without allowing
-- browser clients to update the flag directly.

create or replace function public.set_profile_password_change_flag(
  target_profile_id uuid,
  required boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform set_config('app.password_workflow', '1', true);

  update public.profiles
  set must_change_password = required,
      updated_at = now()
  where id = target_profile_id;

  if not found then
    raise exception 'Profile was not found.';
  end if;
end;
$$;

revoke all on function public.set_profile_password_change_flag(uuid, boolean) from public;
grant execute on function public.set_profile_password_change_flag(uuid, boolean) to service_role;

create or replace function public.prevent_client_password_flag_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.must_change_password is distinct from new.must_change_password
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and coalesce(current_setting('app.password_workflow', true), '') <> '1' then
    raise exception 'must_change_password can only be changed by the password workflow';
  end if;
  return new;
end;
$$;