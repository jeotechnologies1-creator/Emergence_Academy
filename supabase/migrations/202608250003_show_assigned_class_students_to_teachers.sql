-- A teacher's Students dashboard is class-based.  There is no manual
-- teacher/student link to maintain: adding a row to teacher_subjects makes
-- every student whose current students.class_id matches visible immediately.
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

revoke all on function public.teacher_can_access_student(uuid) from public;
grant execute on function public.teacher_can_access_student(uuid) to authenticated;

alter table public.students enable row level security;
drop policy if exists teacher_read_assigned_students on public.students;
create policy teacher_read_assigned_students on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and public.teacher_can_access_student(id)
  );

-- The student table is rendered with the linked profile, so names and contact
-- details need the same class-based scope.
alter table public.profiles enable row level security;
drop policy if exists teacher_read_assigned_student_profiles on public.profiles;
create policy teacher_read_assigned_student_profiles on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.students s
      where s.profile_id = profiles.id
        and public.teacher_can_access_student(s.id)
    )
  );
