-- Keep student admission, the office dashboard, and the teacher portal on
-- the same source of truth: public.students and its assigned class.
--
-- Older accounts may still carry role aliases in their Auth JWT (for example
-- "administrator").  The browser normalizes those aliases, but the previous
-- RLS helper did not, which could make an apparent admin see a partial
-- student register or a zero/incorrect dashboard count.
create or replace function public.current_user_role()
returns text
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select case lower(trim(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    ''
  )))
    when 'administrator' then 'admin'
    when 'super admin' then 'admin'
    when 'admissions' then 'admission'
    else lower(trim(coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role',
      ''
    )))
  end;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- Recreate student-read policies so legacy policies cannot shadow the current
-- office and teacher access rules.  Teacher visibility is intentionally based
-- on class membership: saving a teacher's class assignment immediately makes
-- every student in that class available to that teacher.
alter table public.students enable row level security;

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

create policy students_read_own on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'student'
    and profile_id = auth.uid()
  );

create policy office_read_students on public.students
  for select to authenticated
  using (
    public.current_user_role() in ('ceo', 'admin', 'executive', 'admission')
  );

create policy parent_read_linked_students on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and public.parent_has_student_access(id)
  );

create policy teacher_read_assigned_students on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and public.teacher_can_access_student(id)
  );

-- Ensure historic student records participate in the active academic session
-- too.  New records are handled by student_auto_enrollment_trigger; this is
-- the one-time repair for records created before that trigger was deployed.
do $$
declare
  student_record record;
begin
  for student_record in
    select id, class_id
    from public.students
    where class_id is not null
  loop
    perform public.ensure_student_enrollment(
      student_record.id,
      student_record.class_id
    );
  end loop;
end $$;
