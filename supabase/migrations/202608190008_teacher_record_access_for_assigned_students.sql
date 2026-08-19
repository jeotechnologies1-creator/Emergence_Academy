-- Keep teacher records aligned with the Students module. Teachers can record
-- attendance for any learner they can see through an assigned class or
-- subject. Grades remain subject-specific and require that the learner offers
-- the subject being graded.
alter table public.attendance enable row level security;
alter table public.grades enable row level security;

drop policy if exists teacher_manage_assigned_attendance on public.attendance;
create policy teacher_manage_assigned_attendance on public.attendance
  for all to authenticated
  using (
    public.current_user_role() = 'teacher'
    and public.teacher_can_access_student(student_id)
    and exists (
      select 1
      from public.students s
      where s.id = attendance.student_id
        and s.class_id = attendance.class_id
    )
  )
  with check (
    public.current_user_role() = 'teacher'
    and public.teacher_can_access_student(student_id)
    and exists (
      select 1
      from public.students s
      where s.id = attendance.student_id
        and s.class_id = attendance.class_id
    )
  );

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
      join public.student_subjects ss
        on ss.student_id = grades.student_id
       and ss.subject_id = grades.subject_id
      where t.profile_id = auth.uid()
        and grades.teacher_id = t.id
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
      join public.student_subjects ss
        on ss.student_id = grades.student_id
       and ss.subject_id = grades.subject_id
      where t.profile_id = auth.uid()
        and grades.teacher_id = t.id
        and ts.subject_id = grades.subject_id
    )
  );
