-- Scheduled classes use a generated Jitsi room name. The same room is opened
-- by the teacher and every student enrolled in the selected class.
create table if not exists public.live_classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject_id uuid not null references public.subjects(id),
  class_id uuid not null references public.classes(id),
  teacher_id uuid not null references public.teachers(id),
  starts_at timestamp with time zone not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
  meeting_room text not null unique,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists live_classes_class_starts_at_idx
  on public.live_classes (class_id, starts_at);

create index if not exists live_classes_teacher_starts_at_idx
  on public.live_classes (teacher_id, starts_at);
