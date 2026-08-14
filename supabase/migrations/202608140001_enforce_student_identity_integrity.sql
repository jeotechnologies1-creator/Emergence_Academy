-- Student admission is the only writer for these identifiers.  The RPC
-- serializes allocation, while these indexes make the database the final
-- authority if another client or migration attempts a duplicate.
create unique index if not exists students_profile_id_unique
  on public.students (profile_id);

create unique index if not exists students_student_no_unique
  on public.students (student_no)
  where student_no is not null;

create unique index if not exists students_admission_number_unique
  on public.students (admission_number)
  where admission_number is not null;
