-- Make teacher roster visibility depend only on the authenticated teacher's
-- actual class assignment. This intentionally does not rely on a role claim
-- in a possibly stale browser JWT.
create or replace function public.teacher_can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.students s
    join public.teacher_subjects ts on ts.class_id = s.class_id
    join public.teachers t on t.id = ts.teacher_id
    where s.id = p_student_id
      and t.profile_id = auth.uid()
  );
$$;

create or replace function public.teacher_can_access_student_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.students s
    join public.teacher_subjects ts on ts.class_id = s.class_id
    join public.teachers t on t.id = ts.teacher_id
    where s.profile_id = p_profile_id
      and t.profile_id = auth.uid()
  );
$$;

revoke all on function public.teacher_can_access_student(uuid) from public;
revoke all on function public.teacher_can_access_student_profile(uuid) from public;
grant execute on function public.teacher_can_access_student(uuid) to authenticated;
grant execute on function public.teacher_can_access_student_profile(uuid) to authenticated;

alter table public.students enable row level security;
drop policy if exists teacher_read_assigned_students on public.students;
create policy teacher_read_assigned_students on public.students
  for select to authenticated
  using (public.teacher_can_access_student(id));

alter table public.profiles enable row level security;
drop policy if exists teacher_read_assigned_student_profiles on public.profiles;
create policy teacher_read_assigned_student_profiles on public.profiles
  for select to authenticated
  using (public.teacher_can_access_student_profile(id));
