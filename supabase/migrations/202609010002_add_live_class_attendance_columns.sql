-- Ensure attendance can be tied to the exact live class + subject when a
-- student joins, while keeping compatibility with existing attendance rows.
alter table public.attendance
  add column if not exists subject_id uuid references public.subjects(id),
  add column if not exists live_class_id uuid references public.live_classes(id);

create index if not exists attendance_student_class_subject_date_idx
  on public.attendance (student_id, class_id, subject_id, date);

create unique index if not exists attendance_live_class_student_unique
  on public.attendance (live_class_id, student_id);
