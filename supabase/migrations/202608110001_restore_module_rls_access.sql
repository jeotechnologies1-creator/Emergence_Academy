-- The tables below already had RLS enabled but no policies, which made their
-- corresponding dashboard modules fail closed for every signed-in user.
-- Administrators manage operational data; authenticated users may read only
-- the non-sensitive reference data needed to render forms and schedules.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'academic_sessions', 'ai_sessions', 'assignment_submissions', 'assignments',
    'audit_logs', 'classes', 'conversations', 'departments', 'documents',
    'exam_results', 'exams', 'fee_categories', 'hostel_allocations',
    'hostel_blocks', 'hostel_rooms', 'library_books', 'library_loans',
    'messages', 'notifications', 'parent_students', 'parents', 'school_settings',
    'student_enrollments', 'student_parents', 'student_transport', 'subjects',
    'teacher_subjects', 'terms', 'timetable', 'transport_routes'
  ] loop
    execute format('drop policy if exists admin_manage_records on public.%I', table_name);
    execute format(
      'create policy admin_manage_records on public.%I for all to authenticated
       using (public.current_user_role() in (''ceo'', ''admin''))
       with check (public.current_user_role() in (''ceo'', ''admin''))',
      table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'academic_sessions', 'classes', 'departments', 'fee_categories',
    'hostel_blocks', 'hostel_rooms', 'library_books', 'subjects', 'terms',
    'timetable', 'transport_routes'
  ] loop
    execute format('drop policy if exists authenticated_read_reference_data on public.%I', table_name);
    execute format(
      'create policy authenticated_read_reference_data on public.%I
       for select to authenticated using (true)',
      table_name
    );
  end loop;
end $$;

-- Assignment records are visible only to staff with a teaching/admin role;
-- student work remains behind its own module-specific authorization.
drop policy if exists staff_read_assignments on public.assignments;
create policy staff_read_assignments on public.assignments
  for select to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive', 'teacher', 'exam'));

drop policy if exists staff_read_teacher_subjects on public.teacher_subjects;
create policy staff_read_teacher_subjects on public.teacher_subjects
  for select to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive', 'teacher', 'exam'));
