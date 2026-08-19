-- Admin and CEO accounts can view, edit, and delete every application profile.
-- The trusted JWT role helper avoids recursive profile policy evaluation.
alter table public.profiles enable row level security;

drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin'))
  with check (public.current_user_role() in ('ceo', 'admin'));
