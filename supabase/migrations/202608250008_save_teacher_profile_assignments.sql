-- Save the department and teaching pairs together from the admin workflow.
-- This is SECURITY DEFINER so a valid office administrator is not dependent
-- on browser RLS policies while completing a teacher enrolment.
create or replace function public.save_teacher_profile_assignments(
  p_teacher_id uuid,
  p_department_id uuid,
  p_class_ids uuid[],
  p_subject_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  expected_assignment_count integer;
  saved_assignment_count integer;
begin
  if public.current_user_role() not in ('ceo', 'admin', 'executive') then
    raise exception 'Only office administrators can save teacher assignments.';
  end if;

  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    raise exception 'Teacher record was not found.';
  end if;

  if cardinality(p_class_ids) is null or cardinality(p_class_ids) = 0
     or cardinality(p_subject_ids) is null or cardinality(p_subject_ids) = 0 then
    raise exception 'Assign at least one class and one subject to the teacher.';
  end if;

  if (select count(*) from public.classes where id = any(p_class_ids)) <> cardinality(p_class_ids)
     or (select count(*) from public.subjects where id = any(p_subject_ids)) <> cardinality(p_subject_ids) then
    raise exception 'One or more selected classes or subjects are no longer available.';
  end if;

  if p_department_id is not null
     and not exists (select 1 from public.departments where id = p_department_id) then
    raise exception 'The selected department is no longer available.';
  end if;

  update public.teachers
     set department_id = p_department_id,
         updated_at = now()
   where id = p_teacher_id;

  insert into public.teacher_subjects (teacher_id, class_id, subject_id)
  select p_teacher_id, selected_class.class_id, selected_subject.subject_id
  from unnest(p_class_ids) as selected_class(class_id)
  cross join unnest(p_subject_ids) as selected_subject(subject_id)
  on conflict (teacher_id, class_id, subject_id) do nothing;

  delete from public.teacher_subjects ts
  where ts.teacher_id = p_teacher_id
    and not exists (
      select 1
      from unnest(p_class_ids) as selected_class(class_id)
      cross join unnest(p_subject_ids) as selected_subject(subject_id)
      where ts.class_id = selected_class.class_id
        and ts.subject_id = selected_subject.subject_id
    );

  select count(*) into saved_assignment_count
  from public.teacher_subjects
  where teacher_id = p_teacher_id;

  expected_assignment_count := cardinality(p_class_ids) * cardinality(p_subject_ids);
  if saved_assignment_count <> expected_assignment_count then
    raise exception 'Teacher assignments could not be verified.';
  end if;

  return saved_assignment_count;
end;
$$;

revoke all on function public.save_teacher_profile_assignments(uuid, uuid, uuid[], uuid[]) from public;
grant execute on function public.save_teacher_profile_assignments(uuid, uuid, uuid[], uuid[]) to authenticated;
