-- The Students module is available to Admission staff as well as Admin/CEO.
-- Earlier dashboard-only policies did not include the admission role, causing
-- valid student records to appear as an empty list and a zero dashboard count.
alter table public.students enable row level security;
alter table public.profiles enable row level security;

drop policy if exists office_read_students on public.students;
create policy office_read_students on public.students
  for select to authenticated
  using (
    public.current_user_role() in ('ceo', 'admin', 'executive', 'admission')
  );

-- Student rows embed the linked profile in the admin Student module. Admission
-- staff need this limited profile read to see names and contact details.
drop policy if exists admission_read_student_profiles on public.profiles;
create policy admission_read_student_profiles on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'admission'
    and role::text = 'student'
  );
