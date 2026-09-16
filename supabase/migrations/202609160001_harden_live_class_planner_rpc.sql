-- The planner and live-class page both use this RPC.  Cast every expression
-- to its declared return type so PostgreSQL does not reject the RPC when a
-- database has a varchar status/employee number from an older deployment.
drop function if exists public.get_live_classes();

create function public.get_live_classes()
returns table (
  id uuid, subject_id uuid, class_id uuid, teacher_id uuid, title text,
  description text, starts_at timestamptz, ends_at timestamptz,
  duration_minutes integer, status text, subject_name text,
  teacher_first_name text, teacher_last_name text, teacher_employee_id text,
  agora_channel_name text
)
language sql stable security definer set search_path = public
as $$
  select
    lc.id, lc.subject_id, lc.class_id, lc.teacher_id, lc.title::text,
    lc.description::text, lc.starts_at, lc.ends_at, lc.duration_minutes,
    (case
      when lc.status in ('cancelled', 'ended') then lc.status
      when now() >= lc.ends_at then 'ended'
      when lc.status = 'live' or now() >= lc.starts_at then 'live'
      else 'upcoming'
    end)::text,
    s.subject_name::text, p.first_name::text, p.last_name::text,
    coalesce(t.employee_id, t.teacher_no)::text, lc.agora_channel_name::text
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
        on lcs.student_id = st.id and lcs.live_class_id = lc.id
      where st.profile_id = auth.uid()
        and public.student_can_access_live_class(st.id, lc.class_id)
    ))
  order by lc.starts_at asc;
$$;

revoke all on function public.get_live_classes() from public, anon;
grant execute on function public.get_live_classes() to authenticated;
