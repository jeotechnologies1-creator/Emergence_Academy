                          -- Repair legacy profile policies that query public.profiles while PostgreSQL
-- is already evaluating a policy for that same table (error 42P17).
-- Role checks must always go through this SECURITY DEFINER lookup.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles no force row level security;

-- Policy names vary between previous releases. Remove every old policy before
-- installing the complete non-recursive set below.
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

create policy admission_read_student_profiles on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'admission'
    and role::text = 'student'
  );

create policy parent_read_linked_student_profiles on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and exists (
      select 1
      from public.parent_students ps
      join public.students s on s.id = ps.student_id
      where s.profile_id = profiles.id
        and public.parent_has_student_access(s.id)
    )
  );

create policy teacher_read_assigned_student_profiles on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.students s
      join public.teacher_subjects ts on ts.class_id = s.class_id
      join public.teachers t on t.id = ts.teacher_id
      where s.profile_id = profiles.id
        and t.profile_id = auth.uid()
    )
  );
