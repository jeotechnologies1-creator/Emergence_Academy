-- Teacher/student access is class-based. A teacher sees every learner enrolled
-- in a class to which the teacher is assigned, regardless of the learner's
-- optional subject enrolments. Subject assignments still determine which
-- subject the teacher may grade or use when scheduling a class.
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

-- A grade remains limited to a subject assigned to the teacher, but every
-- student in that assigned class is eligible for that subject's grade record.
drop policy if exists teacher_manage_assigned_grades on public.grades;
create policy teacher_manage_assigned_grades on public.grades
  for all to authenticated
  using (
    public.current_user_role() = 'teacher'
    and public.teacher_can_access_student(student_id)
    and exists (
      select 1
      from public.teachers t
      join public.teacher_subjects ts on ts.teacher_id = t.id
      join public.students s on s.id = grades.student_id
      where t.profile_id = auth.uid()
        and grades.teacher_id = t.id
        and ts.class_id = s.class_id
        and ts.subject_id = grades.subject_id
    )
  )
  with check (
    public.current_user_role() = 'teacher'
    and public.teacher_can_access_student(student_id)
    and exists (
      select 1
      from public.teachers t
      join public.teacher_subjects ts on ts.teacher_id = t.id
      join public.students s on s.id = grades.student_id
      where t.profile_id = auth.uid()
        and grades.teacher_id = t.id
        and ts.class_id = s.class_id
        and ts.subject_id = grades.subject_id
    )
  );
