-- Self-contained repair for databases where older profiles policies remain.
-- Run this migration after all earlier migrations. It deliberately does not
-- depend on a previous policy-repair migration having been applied.

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

alter table public.profiles enable row level security;
alter table public.profiles no force row level security;

-- Remove every legacy policy, including unknown policy names left over from
-- manual dashboard changes. None of the policies recreated below selects from
-- public.profiles to decide whether it may read public.profiles.
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
