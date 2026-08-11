-- Student enrolment is independent of teacher assignments.  A student may
-- belong to one department and any number of subjects; parents are linked to
-- students, never to teacher records.
-- Recreate the Auth trigger with an UPSERT. This prevents profiles_pkey errors
-- when Auth retries a user event or a profile was provisioned beforehand.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := lower(trim(coalesce(new.raw_user_meta_data ->> 'role', 'student')));
  profile_role public.user_role;
begin
  if requested_role = any(enum_range(null::public.user_role)::text[]) then
    profile_role := requested_role::public.user_role;
  else
    profile_role := 'student'::public.user_role;
  end if;

  insert into public.profiles (id, email, role, first_name, last_name, phone, status)
  values (
    new.id, coalesce(new.email, ''), profile_role,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'active'::public.account_status
  )
  on conflict (id) do update set
    email = excluded.email,
    role = excluded.role,
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.students
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists students_department_id_idx on public.students (department_id);

create table if not exists public.student_subjects (
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, subject_id)
);

create index if not exists student_subjects_subject_id_idx on public.student_subjects (subject_id);

-- Some installations already have this table.  The ALTER statements make the
-- expected link columns available without replacing existing parent records.
create table if not exists public.parent_students (
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

alter table public.parent_students
  add column if not exists parent_id uuid references public.parents(id) on delete cascade,
  add column if not exists student_id uuid references public.students(id) on delete cascade,
  add column if not exists relationship text;

create unique index if not exists parent_students_parent_student_key
  on public.parent_students (parent_id, student_id);
create index if not exists parent_students_student_id_idx on public.parent_students (student_id);

alter table public.student_subjects enable row level security;

create or replace function public.parent_has_student_access(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_students ps
    join public.parents p on p.id = ps.parent_id
    where ps.student_id = p_student_id and p.profile_id = auth.uid()
  )
$$;

revoke all on function public.parent_has_student_access(uuid) from public, anon;
grant execute on function public.parent_has_student_access(uuid) to authenticated;

drop policy if exists student_subjects_admin_manage on public.student_subjects;
create policy student_subjects_admin_manage on public.student_subjects for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive', 'admission'))
  with check (public.current_user_role() in ('ceo', 'admin', 'executive', 'admission'));

drop policy if exists parent_read_linked_students on public.students;
create policy parent_read_linked_students on public.students for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and public.parent_has_student_access(students.id)
  );

drop policy if exists parent_read_linked_student_profiles on public.profiles;
create policy parent_read_linked_student_profiles on public.profiles for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and exists (
      select 1 from public.parent_students ps
      join public.students s on s.id = ps.student_id
      where s.profile_id = profiles.id and public.parent_has_student_access(s.id)
    )
  );

drop policy if exists parent_read_linked_student_subjects on public.student_subjects;
create policy parent_read_linked_student_subjects on public.student_subjects for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and public.parent_has_student_access(student_subjects.student_id)
  );

-- Parent accounts may read only records belonging to a student linked above.
-- No teacher relationship is consulted anywhere in this access path.
drop policy if exists parent_read_linked_attendance on public.attendance;
create policy parent_read_linked_attendance on public.attendance for select to authenticated
  using (public.current_user_role() = 'parent' and public.parent_has_student_access(student_id));

drop policy if exists parent_read_linked_grades on public.grades;
create policy parent_read_linked_grades on public.grades for select to authenticated
  using (public.current_user_role() = 'parent' and public.parent_has_student_access(student_id));

drop policy if exists parent_read_linked_payments on public.payments;
create policy parent_read_linked_payments on public.payments for select to authenticated
  using (public.current_user_role() = 'parent' and public.parent_has_student_access(student_id));
