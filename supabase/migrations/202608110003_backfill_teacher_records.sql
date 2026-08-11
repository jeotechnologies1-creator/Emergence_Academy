-- Earlier teacher accounts could be created as profiles without their required
-- teachers row. Backfill a stable, unique legacy teacher number so those users
-- can load the teacher dashboard and receive administrator assignments.
insert into public.teachers (profile_id, teacher_no, employee_id, status)
select
  p.id,
  'T-LEGACY-' || upper(left(replace(p.id::text, '-', ''), 8)),
  'LEGACY-' || upper(left(replace(p.id::text, '-', ''), 8)),
  'active'
from public.profiles p
where lower(p.role::text) = 'teacher'
  and not exists (
    select 1 from public.teachers t where t.profile_id = p.id
  );
