-- One source of truth for every teacher assessment workflow. A teacher can
-- see every student in a class where they hold at least one subject assignment.
-- This is intentionally class-based for all levels, from Primary through SSS;
-- subject matching is applied only when recording a subject-specific grade.
create index if not exists students_class_id_idx on public.students (class_id);
create index if not exists teachers_profile_id_idx on public.teachers (profile_id);

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
    join public.teacher_subjects ts on ts.class_id = s.class_id
    join public.teachers t on t.id = ts.teacher_id
    where s.id = p_student_id
      and t.profile_id = auth.uid()
  );
$$;

create or replace function public.teacher_can_grade_student(
  p_student_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.students s
    join public.teacher_subjects ts
      on ts.class_id = s.class_id
     and ts.subject_id = p_subject_id
    join public.teachers t on t.id = ts.teacher_id
    where s.id = p_student_id
      and t.profile_id = auth.uid()
  );
$$;

create or replace function public.teacher_can_access_student_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.students s
    where s.profile_id = p_profile_id
      and public.teacher_can_access_student(s.id)
  );
$$;

revoke all on function public.teacher_can_access_student(uuid) from public;
revoke all on function public.teacher_can_grade_student(uuid, uuid) from public;
revoke all on function public.teacher_can_access_student_profile(uuid) from public;
grant execute on function public.teacher_can_access_student(uuid) to authenticated;
grant execute on function public.teacher_can_grade_student(uuid, uuid) to authenticated;
grant execute on function public.teacher_can_access_student_profile(uuid) to authenticated;

alter table public.teacher_subjects enable row level security;
drop policy if exists teacher_read_own_subject_assignments on public.teacher_subjects;
create policy teacher_read_own_subject_assignments on public.teacher_subjects
  for select to authenticated
  using (
    exists (
      select 1 from public.teachers t
      where t.id = teacher_subjects.teacher_id
        and t.profile_id = auth.uid()
    )
  );

alter table public.students enable row level security;
drop policy if exists teacher_read_assigned_students on public.students;
create policy teacher_read_assigned_students on public.students
  for select to authenticated
  using (public.teacher_can_access_student(id));

alter table public.profiles enable row level security;
drop policy if exists teacher_read_assigned_student_profiles on public.profiles;
create policy teacher_read_assigned_student_profiles on public.profiles
  for select to authenticated
  using (public.teacher_can_access_student_profile(id));

alter table public.attendance enable row level security;
drop policy if exists teacher_manage_assigned_attendance on public.attendance;
create policy teacher_manage_assigned_attendance on public.attendance
  for all to authenticated
  using (
    public.teacher_can_access_student(student_id)
    and exists (
      select 1
      from public.students s
      where s.id = attendance.student_id
        and s.class_id = attendance.class_id
    )
  )
  with check (
    public.teacher_can_access_student(student_id)
    and exists (
      select 1
      from public.students s
      where s.id = attendance.student_id
        and s.class_id = attendance.class_id
    )
  );

alter table public.grades enable row level security;
drop policy if exists teacher_manage_assigned_grades on public.grades;
create policy teacher_manage_assigned_grades on public.grades
  for all to authenticated
  using (
    public.teacher_can_grade_student(student_id, subject_id)
    and exists (
      select 1 from public.teachers t
      where t.id = grades.teacher_id
        and t.profile_id = auth.uid()
    )
  )
  with check (
    public.teacher_can_grade_student(student_id, subject_id)
    and exists (
      select 1 from public.teachers t
      where t.id = grades.teacher_id
        and t.profile_id = auth.uid()
    )
  );

alter table public.assignments enable row level security;
drop policy if exists assignment_teacher_manage_own on public.assignments;
create policy assignment_teacher_manage_own on public.assignments
  for all to authenticated
  using (
    exists (
      select 1 from public.teachers t
      where t.id = assignments.teacher_id
        and t.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.teachers t
      join public.teacher_subjects ts on ts.teacher_id = t.id
      where t.id = assignments.teacher_id
        and t.profile_id = auth.uid()
        and ts.class_id = assignments.class_id
        and ts.subject_id = assignments.subject_id
    )
  );

alter table public.assignment_submissions enable row level security;
drop policy if exists submission_teacher_read_own_assignment on public.assignment_submissions;
create policy submission_teacher_read_own_assignment on public.assignment_submissions
  for select to authenticated
  using (
    exists (
      select 1
      from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id = assignment_submissions.assignment_id
        and t.profile_id = auth.uid()
    )
  );
