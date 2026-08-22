-- Rich teacher assignments: multiple questions with optional image prompts and
-- one text/image response per student. Images live in a private bucket.
alter table public.assignments add column if not exists questions jsonb not null default '[]'::jsonb;

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answer_text text not null default '',
  answer_image_paths jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

alter table public.assignment_submissions
  add column if not exists answer_text text not null default '',
  add column if not exists answer_image_paths jsonb not null default '[]'::jsonb,
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists assignment_submissions_assignment_student_idx on public.assignment_submissions (assignment_id, student_id);
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

drop policy if exists teacher_read_own_assignments on public.assignments;
create policy teacher_read_own_assignments on public.assignments for select to authenticated using (
  public.current_user_role() = 'teacher' and exists (select 1 from public.teachers t where t.id = assignments.teacher_id and t.profile_id = auth.uid())
);
drop policy if exists teacher_create_assigned_assignments on public.assignments;
create policy teacher_create_assigned_assignments on public.assignments for insert to authenticated with check (
  public.current_user_role() = 'teacher' and exists (
    select 1 from public.teachers t join public.teacher_subjects ts on ts.teacher_id = t.id
    where t.id = assignments.teacher_id and t.profile_id = auth.uid() and ts.class_id = assignments.class_id and ts.subject_id = assignments.subject_id
  )
);
drop policy if exists teacher_update_own_assignments on public.assignments;
create policy teacher_update_own_assignments on public.assignments for update to authenticated using (
  public.current_user_role() = 'teacher' and exists (select 1 from public.teachers t where t.id = assignments.teacher_id and t.profile_id = auth.uid())
) with check (
  public.current_user_role() = 'teacher' and exists (
    select 1 from public.teachers t join public.teacher_subjects ts on ts.teacher_id = t.id
    where t.id = assignments.teacher_id and t.profile_id = auth.uid() and ts.class_id = assignments.class_id and ts.subject_id = assignments.subject_id
  )
);
drop policy if exists students_read_class_assignments on public.assignments;
create policy students_read_class_assignments on public.assignments for select to authenticated using (
  public.current_user_role() = 'student' and status in ('published', 'closed') and exists (
    select 1 from public.students s where s.profile_id = auth.uid() and s.class_id = assignments.class_id
  )
);

drop policy if exists teacher_read_assignment_submissions on public.assignment_submissions;
create policy teacher_read_assignment_submissions on public.assignment_submissions for select to authenticated using (
  public.current_user_role() = 'teacher' and exists (
    select 1 from public.assignments a join public.teachers t on t.id = a.teacher_id where a.id = assignment_submissions.assignment_id and t.profile_id = auth.uid()
  )
);
drop policy if exists student_read_own_assignment_submissions on public.assignment_submissions;
create policy student_read_own_assignment_submissions on public.assignment_submissions for select to authenticated using (
  public.current_user_role() = 'student' and exists (select 1 from public.students s where s.id = assignment_submissions.student_id and s.profile_id = auth.uid())
);
drop policy if exists student_submit_class_assignment on public.assignment_submissions;
create policy student_submit_class_assignment on public.assignment_submissions for insert to authenticated with check (
  public.current_user_role() = 'student' and exists (
    select 1 from public.students s join public.assignments a on a.id = assignment_submissions.assignment_id
    where s.id = assignment_submissions.student_id and s.profile_id = auth.uid() and s.class_id = a.class_id and a.status = 'published' and a.due_date >= current_date
  )
);
drop policy if exists student_update_own_assignment_submission on public.assignment_submissions;
create policy student_update_own_assignment_submission on public.assignment_submissions for update to authenticated using (
  public.current_user_role() = 'student' and exists (select 1 from public.students s where s.id = assignment_submissions.student_id and s.profile_id = auth.uid())
) with check (
  public.current_user_role() = 'student' and exists (
    select 1 from public.students s join public.assignments a on a.id = assignment_submissions.assignment_id
    where s.id = assignment_submissions.student_id and s.profile_id = auth.uid() and s.class_id = a.class_id and a.status = 'published' and a.due_date >= current_date
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignment-images', 'assignment-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists assignment_images_read_authenticated on storage.objects;
create policy assignment_images_read_authenticated on storage.objects for select to authenticated using (bucket_id = 'assignment-images');
drop policy if exists assignment_images_upload_own_folder on storage.objects;
create policy assignment_images_upload_own_folder on storage.objects for insert to authenticated with check (bucket_id = 'assignment-images' and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists assignment_images_update_own_folder on storage.objects;
create policy assignment_images_update_own_folder on storage.objects for update to authenticated using (bucket_id = 'assignment-images' and split_part(name, '/', 1) = auth.uid()::text) with check (bucket_id = 'assignment-images' and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists assignment_images_delete_own_folder on storage.objects;
create policy assignment_images_delete_own_folder on storage.objects for delete to authenticated using (bucket_id = 'assignment-images' and split_part(name, '/', 1) = auth.uid()::text);
