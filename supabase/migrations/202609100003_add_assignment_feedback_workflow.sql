-- Complete the assignment lifecycle: a student submits work and the assigned
-- teacher reviews, scores, gives feedback, and returns it.  The trigger is
-- intentional: RLS controls rows, but it cannot restrict individual columns.

alter table public.assignment_submissions
  add column if not exists status text not null default 'submitted',
  add column if not exists score numeric,
  add column if not exists feedback text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.assignment_submissions
  drop constraint if exists assignment_submissions_status_check;

alter table public.assignment_submissions
  add constraint assignment_submissions_status_check
  check (status in ('submitted', 'returned'));

alter table public.assignment_submissions
  add constraint assignment_submissions_score_check
  check (score is null or score >= 0);

alter table public.assignment_submissions
  add constraint assignment_submissions_feedback_length_check
  check (feedback is null or char_length(feedback) <= 5000);

create index if not exists assignment_submissions_review_queue_idx
  on public.assignment_submissions (assignment_id, status, submitted_at);

create or replace function public.protect_assignment_submission_review()
returns trigger
language plpgsql
as $$
declare
  actor_role text := public.current_user_role();
begin
  if actor_role = 'student' then
    if tg_op = 'UPDATE' and (
      new.assignment_id is distinct from old.assignment_id
      or new.student_id is distinct from old.student_id
    ) then
      raise exception 'A submission cannot be moved to another assignment or student.';
    end if;

    -- Students may resubmit before the deadline, but cannot forge a review.
    new.status := 'submitted';
    new.score := null;
    new.feedback := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.submitted_at := now();
    new.updated_at := now();
    return new;
  end if;

  if actor_role = 'teacher' then
    if tg_op <> 'UPDATE' then
      raise exception 'Teachers can only review existing student submissions.';
    end if;
    if new.assignment_id is distinct from old.assignment_id
      or new.student_id is distinct from old.student_id
      or new.answer_text is distinct from old.answer_text
      or new.answer_image_paths is distinct from old.answer_image_paths
      or new.submitted_at is distinct from old.submitted_at then
      raise exception 'Teachers may only change review fields.';
    end if;
    if new.status <> 'returned' then
      raise exception 'A teacher review must return the submission to the student.';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
    new.updated_at := now();
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists assignment_submission_review_protection on public.assignment_submissions;
create trigger assignment_submission_review_protection
before insert or update on public.assignment_submissions
for each row execute function public.protect_assignment_submission_review();

-- The existing teacher policy grants read access only.  Add a narrowly scoped
-- review policy for submissions belonging to assignments the teacher owns.
drop policy if exists submission_teacher_review_own_assignment on public.assignment_submissions;
create policy submission_teacher_review_own_assignment on public.assignment_submissions
  for update to authenticated
  using (
    exists (
      select 1 from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id = assignment_submissions.assignment_id
        and t.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id = assignment_submissions.assignment_id
        and t.profile_id = auth.uid()
    )
  );

comment on column public.assignment_submissions.status is
  'Student work is submitted, then returned after teacher review.';