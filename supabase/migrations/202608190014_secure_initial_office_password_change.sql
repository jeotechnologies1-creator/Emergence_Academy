-- Office account passwords belong only in Supabase Auth (as hashes). The
-- profile flag is protected so an account owner cannot bypass the one-time
-- initial password replacement by changing the flag from the browser.
create or replace function public.prevent_client_password_flag_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.must_change_password is distinct from new.must_change_password
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
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
