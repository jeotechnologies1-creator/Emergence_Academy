-- Teacher enrollment assigns every selected class/subject combination. The
-- unique index keeps a retry from creating duplicate teaching assignments.
create table if not exists public.teacher_subjects (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists teacher_subjects_teacher_class_subject_key
  on public.teacher_subjects (teacher_id, class_id, subject_id);

create index if not exists teacher_subjects_class_id_idx
  on public.teacher_subjects (class_id);

alter table public.teacher_subjects enable row level security;

-- A teacher can see only their own class and subject assignments. Admin and
-- CEO management remains covered by the existing admin_manage_records policy.
drop policy if exists teacher_read_own_subject_assignments on public.teacher_subjects;
create policy teacher_read_own_subject_assignments on public.teacher_subjects
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.teachers t
      where t.id = teacher_subjects.teacher_id and t.profile_id = auth.uid()
    )
  );

-- Teachers may view students and their profiles only where they have at least
-- one assignment for that student's current class.
drop policy if exists teacher_read_assigned_students on public.students;
create policy teacher_read_assigned_students on public.students
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.teacher_subjects ts
      join public.teachers t on t.id = ts.teacher_id
      where t.profile_id = auth.uid() and ts.class_id = students.class_id
    )
  );

drop policy if exists teacher_read_assigned_student_profiles on public.profiles;
create policy teacher_read_assigned_student_profiles on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.students s
      join public.teacher_subjects ts on ts.class_id = s.class_id
      join public.teachers t on t.id = ts.teacher_id
      where s.profile_id = profiles.id and t.profile_id = auth.uid()
    )
  );

-- Attendance is class-based: any teacher assigned to the student's class may
-- keep the daily record. Grades additionally require the assigned subject.
drop policy if exists teacher_manage_assigned_attendance on public.attendance;
create policy teacher_manage_assigned_attendance on public.attendance
  for all to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.teacher_subjects ts
      join public.teachers t on t.id = ts.teacher_id
      where t.profile_id = auth.uid() and ts.class_id = attendance.class_id
    )
  )
  with check (
    public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.teacher_subjects ts
      join public.teachers t on t.id = ts.teacher_id
      where t.profile_id = auth.uid() and ts.class_id = attendance.class_id
    )
  );

drop policy if exists teacher_manage_assigned_grades on public.grades;
create policy teacher_manage_assigned_grades on public.grades
  for all to authenticated
  using (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.teachers t
      join public.teacher_subjects ts on ts.teacher_id = t.id
      join public.students s on s.id = grades.student_id
      where t.profile_id = auth.uid()
        and grades.teacher_id = t.id
        and ts.subject_id = grades.subject_id
        and ts.class_id = s.class_id
    )
  )
  with check (
    public.current_user_role() = 'teacher'
    and exists (
      select 1
      from public.teachers t
      join public.teacher_subjects ts on ts.teacher_id = t.id
      join public.students s on s.id = grades.student_id
      where t.profile_id = auth.uid()
        and grades.teacher_id = t.id
        and ts.subject_id = grades.subject_id
        and ts.class_id = s.class_id
    )
  );
