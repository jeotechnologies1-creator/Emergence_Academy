-- Preserve an explicit teacher start/end action while still deriving status
-- from the schedule when a class has not been manually changed.
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
      when lc.status in ('cancelled', 'ended') then lc.status
      when now() >= lc.ends_at then 'ended'
      when lc.status = 'live' then 'live'
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

create or replace function public.set_live_class_status(
  p_live_class_id uuid,
  p_status text
)
returns public.live_classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.live_classes;
  v_result public.live_classes;
begin
  if p_status not in ('live', 'ended', 'cancelled') then
    raise exception 'Invalid live class status.' using errcode = '22023';
  end if;

  select lc.* into v_current
  from public.live_classes lc
  where lc.id = p_live_class_id
    and (
      public.current_user_role() in ('ceo', 'admin', 'executive')
      or exists (
        select 1 from public.teachers t
        where t.id = lc.teacher_id and t.profile_id = auth.uid()
      )
    )
  for update;

  if not found then
    raise exception 'Live class was not found or is not yours.' using errcode = '42501';
  end if;
  if v_current.status in ('ended', 'cancelled') then
    raise exception 'An ended or cancelled class cannot be restarted.' using errcode = '22023';
  end if;
  if p_status = 'live' and now() >= v_current.ends_at then
    raise exception 'This live class has already ended.' using errcode = '22023';
  end if;

  update public.live_classes
     set status = p_status,
         updated_at = now()
   where id = p_live_class_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_live_classes() from public, anon;
grant execute on function public.get_live_classes() to authenticated;
revoke all on function public.set_live_class_status(uuid, text) from public, anon;
grant execute on function public.set_live_class_status(uuid, text) to authenticated;
