-- Administrators review teacher assignments and student work, but receive no
-- write policy here. Teachers and students retain their existing workflows.
drop policy if exists admin_read_assignments on public.assignments;
create policy admin_read_assignments on public.assignments
  for select to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive'));

drop policy if exists admin_read_assignment_submissions on public.assignment_submissions;
create policy admin_read_assignment_submissions on public.assignment_submissions
  for select to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive'));
