-- School curriculum per class. This is separate from teacher_subjects: admins
-- define what a class offers, then teachers are assigned to teach those items.
create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (class_id, subject_id)
);

create index if not exists class_subjects_class_id_idx on public.class_subjects(class_id);
alter table public.class_subjects enable row level security;

drop policy if exists class_subjects_read_authenticated on public.class_subjects;
create policy class_subjects_read_authenticated on public.class_subjects
  for select to authenticated using (true);

drop policy if exists class_subjects_admin_manage on public.class_subjects;
create policy class_subjects_admin_manage on public.class_subjects
  for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive'))
  with check (public.current_user_role() in ('ceo', 'admin', 'executive'));
