-- Repair legacy RLS policies that query public.students while PostgreSQL is
-- already evaluating access to public.students (error 42P17).
-- This is self-contained and removes unknown policies left by older releases.

alter table public.students enable row level security;
alter table public.students no force row level security;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'students'
  loop
    execute format('drop policy if exists %I on public.students', policy_name);
  end loop;
end $$;

-- Students can see only their own record.
create policy students_read_own on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'student'
    and profile_id = auth.uid()
  );

-- Office staff can view the admission register. Writes continue through the
-- trusted admit-student Edge Function rather than direct browser access.
create policy office_read_students on public.students
  for select to authenticated
  using (
    public.current_user_role() in ('ceo', 'admin', 'executive', 'admission')
  );

-- A parent can see only a child linked through parent_students.
create policy parent_read_linked_students on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and public.parent_has_student_access(id)
  );

-- A teacher can see students only in a class assigned to that teacher.
create policy teacher_read_assigned_students on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.teacher_subjects ts
      join public.teachers t on t.id = ts.teacher_id
      where t.profile_id = auth.uid()
        and ts.class_id = students.class_id
    )
  );
