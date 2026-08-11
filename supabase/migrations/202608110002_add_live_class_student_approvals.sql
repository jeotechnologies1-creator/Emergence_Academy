-- Explicit approval is required in addition to class enrollment before a
-- student receives or can use a Google Meet link.
create table if not exists public.live_class_students (
  id uuid primary key default gen_random_uuid(),
  live_class_id uuid not null references public.live_classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  approved_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (live_class_id, student_id)
);

create index if not exists live_class_students_student_idx
  on public.live_class_students (student_id, live_class_id);

alter table public.live_class_students enable row level security;
drop policy if exists live_class_students_admin_manage on public.live_class_students;
create policy live_class_students_admin_manage on public.live_class_students
  for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin'))
  with check (public.current_user_role() in ('ceo', 'admin'));

create or replace function public.get_live_classes()
returns table (
  id uuid, subject_id uuid, class_id uuid, teacher_id uuid, title text,
  description text, starts_at timestamptz, ends_at timestamptz,
  duration_minutes integer, status text, subject_name text,
  teacher_first_name text, teacher_last_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select lc.id, lc.subject_id, lc.class_id, lc.teacher_id, lc.title,
         lc.description, lc.starts_at, lc.ends_at, lc.duration_minutes,
         case
           when lc.status = 'cancelled' then 'cancelled'
           when now() >= lc.ends_at then 'ended'
           when now() >= lc.starts_at then 'live'
           else 'upcoming'
         end,
         s.subject_name, p.first_name, p.last_name
    from public.live_classes lc
    join public.subjects s on s.id = lc.subject_id
    join public.teachers t on t.id = lc.teacher_id
    join public.profiles p on p.id = t.profile_id
   where public.current_user_role() in ('ceo', 'admin', 'executive')
      or (public.current_user_role() = 'teacher' and t.profile_id = auth.uid())
      or (public.current_user_role() = 'student' and exists (
            select 1
            from public.students st
            join public.live_class_students lcs on lcs.student_id = st.id and lcs.live_class_id = lc.id
            where st.profile_id = auth.uid()
              and public.student_can_access_live_class(st.id, lc.class_id)
          ))
   order by lc.starts_at asc;
$$;

revoke all on function public.get_live_classes() from public, anon;
grant execute on function public.get_live_classes() to authenticated;
