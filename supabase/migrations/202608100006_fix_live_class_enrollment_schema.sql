-- Repair installations where migration 005 was applied before the actual
-- class-based enrollment schema was inspected.
drop function if exists public.student_is_enrolled_in_subject(uuid, uuid);

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
  ) or exists (
    -- Newly admitted students are assigned directly to students.class_id.
    -- Keep them eligible until a formal session enrollment is created.
    select 1 from public.students
    where id = p_student_id and class_id = p_class_id
  )
$$;

revoke all on function public.student_can_access_live_class(uuid, uuid) from public, anon;
grant execute on function public.student_can_access_live_class(uuid, uuid) to authenticated;

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

revoke all on function public.get_live_classes() from public, anon;
grant execute on function public.get_live_classes() to authenticated;
