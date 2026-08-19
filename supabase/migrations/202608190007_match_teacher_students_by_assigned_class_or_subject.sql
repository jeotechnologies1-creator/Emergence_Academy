-- A teacher's Students module includes learners who match at least one of the
-- teacher's assignments: either the learner is in an assigned class or the
-- learner offers an assigned subject. The existing student/profile/subject
-- policies delegate to this helper, so the expanded visibility is applied
-- consistently throughout the teacher portal.
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
    join public.teacher_subjects ts on true
    join public.teachers t on t.id = ts.teacher_id
    where s.id = p_student_id
      and t.profile_id = auth.uid()
      and (
        ts.class_id = s.class_id
        or exists (
          select 1
          from public.student_subjects ss
          where ss.student_id = s.id
            and ss.subject_id = ts.subject_id
        )
      )
  );
$$;

revoke all on function public.teacher_can_access_student(uuid) from public;
grant execute on function public.teacher_can_access_student(uuid) to authenticated;
