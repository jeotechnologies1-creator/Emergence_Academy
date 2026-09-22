-- Course-hub content and guardian digest consent. All reader policies are
-- derived from class/subject enrolment or an existing guardian link.
create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text,
  resource_url text not null check (resource_url ~* '^https://'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.course_announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  published_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.guardian_digest_preferences (
  parent_id uuid primary key references public.parents(id) on delete cascade,
  enabled boolean not null default false,
  frequency text not null default 'weekly' check (frequency in ('daily', 'weekly')),
  updated_at timestamptz not null default now()
);

create index if not exists course_resources_course_idx on public.course_resources(class_id, subject_id, created_at desc);
create index if not exists course_announcements_course_idx on public.course_announcements(class_id, subject_id, published_at desc);

alter table public.course_resources enable row level security;
alter table public.course_announcements enable row level security;
alter table public.guardian_digest_preferences enable row level security;

create policy course_resources_read_enrolled on public.course_resources for select to authenticated using (
  public.current_user_role() in ('ceo','admin','executive')
  or exists (select 1 from public.teachers t where t.id = teacher_id and t.profile_id = auth.uid())
  or (public.current_user_role() = 'student' and exists (select 1 from public.students s join public.student_subjects ss on ss.student_id=s.id and ss.subject_id=course_resources.subject_id where s.profile_id=auth.uid() and s.class_id=course_resources.class_id))
  or (public.current_user_role() = 'parent' and exists (select 1 from public.parent_students ps join public.parents p on p.id=ps.parent_id join public.students s on s.id=ps.student_id join public.student_subjects ss on ss.student_id=s.id and ss.subject_id=course_resources.subject_id where p.profile_id=auth.uid() and s.class_id=course_resources.class_id))
);
create policy course_resources_teacher_write on public.course_resources for all to authenticated using (
  exists (select 1 from public.teachers t where t.id=teacher_id and t.profile_id=auth.uid())
) with check (exists (select 1 from public.teachers t join public.teacher_subjects ts on ts.teacher_id=t.id where t.id=teacher_id and t.profile_id=auth.uid() and ts.class_id=course_resources.class_id and ts.subject_id=course_resources.subject_id));
create policy course_resources_admin_write on public.course_resources for all to authenticated using (public.current_user_role() in ('ceo','admin','executive')) with check (public.current_user_role() in ('ceo','admin','executive'));

create policy course_announcements_read_enrolled on public.course_announcements for select to authenticated using (
  public.current_user_role() in ('ceo','admin','executive')
  or exists (select 1 from public.teachers t where t.profile_id=auth.uid() and (course_announcements.subject_id is null or exists (select 1 from public.teacher_subjects ts where ts.teacher_id=t.id and ts.class_id=course_announcements.class_id and ts.subject_id=course_announcements.subject_id)))
  or (public.current_user_role()='student' and exists (select 1 from public.students s where s.profile_id=auth.uid() and s.class_id=course_announcements.class_id))
  or (public.current_user_role()='parent' and exists (select 1 from public.parent_students ps join public.parents p on p.id=ps.parent_id join public.students s on s.id=ps.student_id where p.profile_id=auth.uid() and s.class_id=course_announcements.class_id))
);
create policy course_announcements_teacher_write on public.course_announcements for all to authenticated using (author_id=auth.uid()) with check (
  author_id=auth.uid() and exists (select 1 from public.teachers t where t.profile_id=auth.uid() and (course_announcements.subject_id is null or exists (select 1 from public.teacher_subjects ts where ts.teacher_id=t.id and ts.class_id=course_announcements.class_id and ts.subject_id=course_announcements.subject_id)))
);
create policy course_announcements_admin_write on public.course_announcements for all to authenticated using (public.current_user_role() in ('ceo','admin','executive')) with check (public.current_user_role() in ('ceo','admin','executive'));

create policy guardian_digest_preferences_own on public.guardian_digest_preferences for all to authenticated using (exists (select 1 from public.parents p where p.id=parent_id and p.profile_id=auth.uid())) with check (exists (select 1 from public.parents p where p.id=parent_id and p.profile_id=auth.uid()));
