-- Teacher-owned term planning: timetable slots describe when a class meets;
-- scheme entries describe what is taught in each week of that term.
create table if not exists public.teacher_timetable_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  starts_at time not null,
  ends_at time not null,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.scheme_of_work_entries (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 20),
  topic text not null check (char_length(trim(topic)) > 0),
  objectives text,
  learning_activities text,
  resources text,
  assessment text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, class_id, subject_id, term_id, week_number)
);

create index if not exists teacher_timetable_slots_teacher_term_idx
  on public.teacher_timetable_slots (teacher_id, term_id, day_of_week, starts_at);
create index if not exists scheme_of_work_entries_teacher_term_idx
  on public.scheme_of_work_entries (teacher_id, term_id, class_id, subject_id, week_number);

alter table public.teacher_timetable_slots enable row level security;
alter table public.scheme_of_work_entries enable row level security;

drop policy if exists teacher_timetable_slots_manage_own on public.teacher_timetable_slots;
create policy teacher_timetable_slots_manage_own on public.teacher_timetable_slots
  for all to authenticated
  using (exists (select 1 from public.teachers t where t.id = teacher_timetable_slots.teacher_id and t.profile_id = auth.uid()))
  with check (exists (
    select 1 from public.teachers t join public.teacher_subjects ts on ts.teacher_id = t.id
    where t.id = teacher_timetable_slots.teacher_id and t.profile_id = auth.uid()
      and ts.class_id = teacher_timetable_slots.class_id and ts.subject_id = teacher_timetable_slots.subject_id
  ));

drop policy if exists scheme_of_work_entries_manage_own on public.scheme_of_work_entries;
create policy scheme_of_work_entries_manage_own on public.scheme_of_work_entries
  for all to authenticated
  using (exists (select 1 from public.teachers t where t.id = scheme_of_work_entries.teacher_id and t.profile_id = auth.uid()))
  with check (exists (
    select 1 from public.teachers t join public.teacher_subjects ts on ts.teacher_id = t.id
    where t.id = scheme_of_work_entries.teacher_id and t.profile_id = auth.uid()
      and ts.class_id = scheme_of_work_entries.class_id and ts.subject_id = scheme_of_work_entries.subject_id
  ));

drop policy if exists teacher_timetable_slots_admin_manage on public.teacher_timetable_slots;
create policy teacher_timetable_slots_admin_manage on public.teacher_timetable_slots
  for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive'))
  with check (public.current_user_role() in ('ceo', 'admin', 'executive'));

drop policy if exists scheme_of_work_entries_admin_manage on public.scheme_of_work_entries;
create policy scheme_of_work_entries_admin_manage on public.scheme_of_work_entries
  for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive'))
  with check (public.current_user_role() in ('ceo', 'admin', 'executive'));
