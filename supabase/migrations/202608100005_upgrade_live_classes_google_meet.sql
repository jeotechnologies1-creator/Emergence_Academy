-- Extend the existing Jitsi-era table; Google Meet URLs are only returned by
-- the join Edge Function after authorization, never from student table reads.
alter table public.live_classes
  add column if not exists description text,
  add column if not exists meeting_url text,
  add column if not exists google_event_id text,
  add column if not exists ends_at timestamp with time zone;

alter table public.live_classes alter column meeting_room drop not null;
create unique index if not exists live_classes_google_event_id_key
  on public.live_classes (google_event_id) where google_event_id is not null;
create index if not exists live_classes_subject_starts_at_idx
  on public.live_classes (subject_id, starts_at);

update public.live_classes
set ends_at = starts_at + make_interval(mins => duration_minutes)
where ends_at is null;

alter table public.live_classes alter column ends_at set not null;

-- The existing enrollment schema links a student to a class. A live class is
-- also linked to that class, so this enforces the available server-side
-- enrollment relationship without exposing meeting URLs to students.
create or replace function public.student_can_access_live_class(
  p_student_id uuid,
  p_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.student_enrollments
    where student_id = p_student_id and class_id = p_class_id
  )
$$;

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
            select 1 from public.students st
            where st.profile_id = auth.uid()
              and public.student_can_access_live_class(st.id, lc.class_id)
          ))
   order by lc.starts_at asc;
$$;

create or replace function public.set_live_class_status(p_live_class_id uuid, p_status text)
returns public.live_classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.live_classes;
begin
  if p_status not in ('live', 'ended', 'cancelled', 'scheduled') then
    raise exception 'Invalid live class status.' using errcode = '22023';
  end if;
  update public.live_classes lc
     set status = p_status, updated_at = now()
   where lc.id = p_live_class_id
     and (
       public.current_user_role() in ('ceo', 'admin', 'executive')
       or exists (select 1 from public.teachers t where t.id = lc.teacher_id and t.profile_id = auth.uid())
     )
  returning lc.* into v_result;
  if not found then raise exception 'Live class was not found or is not yours.' using errcode = '42501'; end if;
  return v_result;
end;
$$;

revoke all on function public.get_live_classes() from public, anon;
grant execute on function public.get_live_classes() to authenticated;
revoke all on function public.student_can_access_live_class(uuid, uuid) from public, anon;
grant execute on function public.student_can_access_live_class(uuid, uuid) to authenticated;
revoke all on function public.set_live_class_status(uuid, text) from public, anon;
grant execute on function public.set_live_class_status(uuid, text) to authenticated;

alter table public.live_classes enable row level security;
drop policy if exists live_classes_admin_manage on public.live_classes;
create policy live_classes_admin_manage on public.live_classes for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive'))
  with check (public.current_user_role() in ('ceo', 'admin', 'executive'));
drop policy if exists live_classes_teacher_read_own on public.live_classes;
create policy live_classes_teacher_read_own on public.live_classes for select to authenticated
  using (exists (select 1 from public.teachers t where t.id = teacher_id and t.profile_id = auth.uid()));
