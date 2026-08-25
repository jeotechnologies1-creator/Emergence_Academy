-- Teachers must only see their own class/subject pairs. The earlier broad
-- staff policy accidentally included the teacher role, which made a teacher
-- portal read another teacher's assignments and select the wrong teacher ID.
drop policy if exists staff_read_teacher_subjects on public.teacher_subjects;

-- Office roles retain their existing admin_manage_records policy. This policy
-- intentionally covers only non-teaching staff that need read-only access.
create policy staff_read_teacher_subjects on public.teacher_subjects
  for select to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive', 'exam'));
