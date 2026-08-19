-- Final teacher portal visibility rule: an administrator's teacher
-- assignment is a class-and-subject pair. A student appears for that teacher
-- only when the student is in the assigned class and offers the assigned
-- subject. No separate teacher/student link is required; updates to either
-- teacher_subjects or student_subjects take effect automatically.
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
    join public.teacher_subjects ts
      on ts.class_id = s.class_id
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
