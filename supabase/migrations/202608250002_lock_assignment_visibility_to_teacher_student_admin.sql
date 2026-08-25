-- Assignment privacy repair.  Remove every legacy policy because prior
-- releases granted broad staff access (including executive and exam roles).
-- Assignments now belong only to the creating teacher, students enrolled in
-- that assignment's class and subject, and office administrators.
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

do $$
declare
  target_table text;
  policy_name text;
begin
  foreach target_table in array array['assignments', 'assignment_submissions']
  loop
    for policy_name in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, target_table);
    end loop;
  end loop;
end $$;

create policy assignment_admin_read on public.assignments
  for select to authenticated
  using (public.current_user_role() in ('ceo', 'admin'));

create policy assignment_teacher_manage_own on public.assignments
  for all to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.teachers t
      where t.id = assignments.teacher_id and t.profile_id = auth.uid()
    )
  )
  with check (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.teachers t
      join public.teacher_subjects ts on ts.teacher_id = t.id
      where t.id = assignments.teacher_id
        and t.profile_id = auth.uid()
        and ts.class_id = assignments.class_id
        and ts.subject_id = assignments.subject_id
    )
  );

create policy assignment_student_read_enrolled_subject on public.assignments
  for select to authenticated
  using (
    public.current_user_role() = 'student'
    and status in ('published', 'closed')
    and exists (
      select 1
      from public.students s
      join public.student_subjects ss
        on ss.student_id = s.id and ss.subject_id = assignments.subject_id
      where s.profile_id = auth.uid() and s.class_id = assignments.class_id
    )
  );

create policy submission_admin_read on public.assignment_submissions
  for select to authenticated
  using (public.current_user_role() in ('ceo', 'admin'));

create policy submission_teacher_read_own_assignment on public.assignment_submissions
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id = assignment_submissions.assignment_id
        and t.profile_id = auth.uid()
    )
  );

create policy submission_student_read_own on public.assignment_submissions
  for select to authenticated
  using (
    public.current_user_role() = 'student'
    and exists (
      select 1 from public.students s
      where s.id = assignment_submissions.student_id and s.profile_id = auth.uid()
    )
  );

create policy submission_student_write_own_enrolled_assignment on public.assignment_submissions
  for all to authenticated
  using (
    public.current_user_role() = 'student'
    and exists (
      select 1
      from public.students s
      join public.assignments a on a.id = assignment_submissions.assignment_id
      join public.student_subjects ss on ss.student_id = s.id and ss.subject_id = a.subject_id
      where s.id = assignment_submissions.student_id
        and s.profile_id = auth.uid()
        and s.class_id = a.class_id
        and a.status = 'published'
        and a.due_date >= current_date
    )
  )
  with check (
    public.current_user_role() = 'student'
    and exists (
      select 1
      from public.students s
      join public.assignments a on a.id = assignment_submissions.assignment_id
      join public.student_subjects ss on ss.student_id = s.id and ss.subject_id = a.subject_id
      where s.id = assignment_submissions.student_id
        and s.profile_id = auth.uid()
        and s.class_id = a.class_id
        and a.status = 'published'
        and a.due_date >= current_date
    )
  );

-- Assignment attachments use paths of the form
--   <profile-id>/questions/<assignment-id>/<file>
--   <profile-id>/answers/<submission-id>/<file>
-- so this helper gives the same three parties access to the files themselves.
create or replace function public.can_read_assignment_image(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    public.current_user_role() in ('ceo', 'admin')
    or exists (
      select 1 from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where split_part(p_object_name, '/', 2) = 'questions'
        and a.id::text = split_part(p_object_name, '/', 3)
        and t.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.assignments a
      join public.students s on s.profile_id = auth.uid() and s.class_id = a.class_id
      join public.student_subjects ss on ss.student_id = s.id and ss.subject_id = a.subject_id
      where split_part(p_object_name, '/', 2) = 'questions'
        and a.id::text = split_part(p_object_name, '/', 3)
    )
    or exists (
      select 1
      from public.assignment_submissions sub
      join public.assignments a on a.id = sub.assignment_id
      join public.teachers t on t.id = a.teacher_id
      where split_part(p_object_name, '/', 2) = 'answers'
        and sub.id::text = split_part(p_object_name, '/', 3)
        and t.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.assignment_submissions sub
      join public.students s on s.id = sub.student_id
      where split_part(p_object_name, '/', 2) = 'answers'
        and sub.id::text = split_part(p_object_name, '/', 3)
        and s.profile_id = auth.uid()
    );
$$;

revoke all on function public.can_read_assignment_image(text) from public;
grant execute on function public.can_read_assignment_image(text) to authenticated;

drop policy if exists assignment_images_read_authenticated on storage.objects;
drop policy if exists assignment_images_read_scoped on storage.objects;
create policy assignment_images_read_scoped on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignment-images'
    and public.can_read_assignment_image(name)
  );
