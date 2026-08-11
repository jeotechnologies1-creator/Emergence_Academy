-- Standard class levels used by every class_id selector in the dashboard.
-- The unique class_name constraint makes this safe to run more than once.
insert into public.classes (class_name)
values
  ('Primary 3'),
  ('Primary 4'),
  ('Primary 5'),
  ('Primary 6'),
  ('JSS 1'),
  ('JSS 2'),
  ('JSS 3'),
  ('SSS 1'),
  ('SSS 2'),
  ('SSS 3')
on conflict (class_name) do nothing;

-- The live-class RPC is recreated to include the same generated employee ID
-- shown in the Teachers, Assignments, and Grades modules.
drop function if exists public.get_live_classes();

create function public.get_live_classes()
returns table (
  id uuid,
  subject_id uuid,
  class_id uuid,
  teacher_id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer,
  status text,
  subject_name text,
  teacher_first_name text,
  teacher_last_name text,
  teacher_employee_id text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    lc.id,
    lc.subject_id,
    lc.class_id,
    lc.teacher_id,
    lc.title,
    lc.description,
    lc.starts_at,
    lc.ends_at,
    lc.duration_minutes,
    case
      when lc.status = 'cancelled' then 'cancelled'
      when now() >= lc.ends_at then 'ended'
      when now() >= lc.starts_at then 'live'
      else 'upcoming'
    end,
    s.subject_name,
    p.first_name,
    p.last_name,
    coalesce(t.employee_id, t.teacher_no)
  from public.live_classes lc
  join public.subjects s on s.id = lc.subject_id
  join public.teachers t on t.id = lc.teacher_id
  join public.profiles p on p.id = t.profile_id
  where public.current_user_role() in ('ceo', 'admin', 'executive')
     or (public.current_user_role() = 'teacher' and t.profile_id = auth.uid())
     or (public.current_user_role() = 'student' and exists (
       select 1
       from public.students st
       join public.live_class_students lcs
         on lcs.student_id = st.id
        and lcs.live_class_id = lc.id
       where st.profile_id = auth.uid()
         and public.student_can_access_live_class(st.id, lc.class_id)
     ))
  order by lc.starts_at asc;
$$;

revoke all on function public.get_live_classes() from public, anon;
grant execute on function public.get_live_classes() to authenticated;
