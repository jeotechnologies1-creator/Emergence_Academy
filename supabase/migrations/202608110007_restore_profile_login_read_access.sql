-- Every authenticated account must be able to read exactly its own profile
-- during login. This policy is intentionally independent of role checks so a
-- broken role helper can never prevent an otherwise valid user from entering.
alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Keep this separately named safety policy for installations that had an
-- older migration remove or rename profiles_read_own.
drop policy if exists profiles_login_read_own on public.profiles;
create policy profiles_login_read_own on public.profiles
  for select to authenticated
  using (id = auth.uid());
