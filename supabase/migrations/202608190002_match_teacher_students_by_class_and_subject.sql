-- A teacher's student list is derived from teacher_subjects. A learner is
-- visible only when the learner is in the assigned class and is enrolled in
-- the assigned subject. This takes effect as soon as an admin saves a teacher
-- assignment; no separate teacher/student link needs to be maintained.

-- This helper runs outside table RLS, preventing the students policy from
-- recursively consulting student_subjects while PostgreSQL evaluates access
-- to students.
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
    join public.student_subjects ss
      on ss.student_id = s.id
     and ss.subject_id = ts.subject_id
    join public.teachers t on t.id = ts.teacher_id
    where s.id = p_student_id
      and t.profile_id = auth.uid()
  );
$$;

revoke all on function public.teacher_can_access_student(uuid) from public;
grant execute on function public.teacher_can_access_student(uuid) to authenticated;

drop policy if exists teacher_read_assigned_students on public.students;
create policy teacher_read_assigned_students on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and public.teacher_can_access_student(id)
  );

-- Student profiles are loaded alongside student records in the dashboard, so
-- protect that path with the same class-and-subject matching rule.
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

drop policy if exists teacher_read_assigned_student_subjects on public.student_subjects;
create policy teacher_read_assigned_student_subjects on public.student_subjects
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and public.teacher_can_access_student(student_id)
  );
