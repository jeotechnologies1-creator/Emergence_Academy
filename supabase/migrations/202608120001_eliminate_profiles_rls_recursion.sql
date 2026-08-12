-- Repair installations that still have legacy profiles policies whose role
-- checks select from profiles. Such a policy is evaluated again while its own
-- check is running, causing PostgreSQL error 42P17 (infinite recursion).

-- This function is deliberately SECURITY DEFINER and disables RLS for its
-- one-row lookup. Policies can therefore check the caller's application role
-- without recursively evaluating policies on public.profiles.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
  select p.role::text
  from public.profiles as p
  where p.id = auth.uid()
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles no force row level security;

-- Policy names differed between earlier deployments. Remove every existing
-- policy rather than assuming a particular legacy name, then install the
-- non-recursive set below.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_name);
  end loop;
end $$;

create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role::text = public.current_user_role());

create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin'))
  with check (public.current_user_role() in ('ceo', 'admin'));

-- Parents may read profiles for their linked children. The relationship
-- lookup is confined to student/parent tables and never selects profiles.
create policy parent_read_linked_student_profiles on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and exists (
      select 1
      from public.parent_students as ps
      join public.students as s on s.id = ps.student_id
      where s.profile_id = profiles.id
        and public.parent_has_student_access(s.id)
    )
  );
