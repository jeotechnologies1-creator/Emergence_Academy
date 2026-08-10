-- The admit-student Edge Function is the trusted caller for this operation.
-- Keep identifier generation in the database to prevent concurrent admission
-- requests from producing duplicate student/admission numbers.
create or replace function public.admit_student(
  p_profile_id uuid,
  p_class_id uuid,
  p_admission_date date default null,
  p_admission_year integer default extract(year from current_date)::integer,
  p_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_prefix text := 'EA' || coalesce(p_admission_year, extract(year from current_date)::integer)::text;
  v_next integer;
  v_number text;
begin
  if p_profile_id is null or p_class_id is null then
    raise exception 'Profile and class are required.' using errcode = '22023';
  end if;

  -- Serialize allocation per admission year without locking unrelated years.
  perform pg_advisory_xact_lock(hashtext(v_prefix));

  select coalesce(max(
    case
      when admission_number ~ ('^' || v_prefix || '[0-9]{4}$')
        then right(admission_number, 4)::integer
      else 0
    end
  ), 0) + 1
    into v_next
    from public.students
   where admission_number like v_prefix || '%';

  v_number := v_prefix || lpad(v_next::text, 4, '0');

  insert into public.students (
    profile_id,
    class_id,
    student_no,
    admission_number,
    admission_date,
    admission_year,
    status
  ) values (
    p_profile_id,
    p_class_id,
    v_number,
    v_number,
    coalesce(p_admission_date, current_date),
    coalesce(p_admission_year, extract(year from current_date)::integer),
    p_status
  ) returning id into v_student_id;

  return v_student_id;
end;
$$;

revoke all on function public.admit_student(uuid, uuid, date, integer, text) from public;
revoke all on function public.admit_student(uuid, uuid, date, integer, text) from anon;
grant execute on function public.admit_student(uuid, uuid, date, integer, text) to service_role;
