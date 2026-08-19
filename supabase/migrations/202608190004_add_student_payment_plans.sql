-- Finance sets one current payment plan per student. Parent submissions remain
-- individual payment records, allowing instalments while keeping the current
-- amount due and ultimatum visible to both portals.
create table if not exists public.student_payment_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  title text not null default 'School fees',
  amount_due numeric(12,2) not null check (amount_due > 0),
  due_date date not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_payment_plans enable row level security;

-- Finance needs the student directory to set plans and reconcile incoming
-- payments, but does not receive write access to student records or profiles.
drop policy if exists finance_read_students_for_payment_plans on public.students;
create policy finance_read_students_for_payment_plans on public.students
  for select to authenticated
  using (public.current_user_role() = 'finance');

drop policy if exists finance_read_student_profiles_for_payment_plans on public.profiles;
create policy finance_read_student_profiles_for_payment_plans on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'finance'
    and role::text = 'student'
  );

drop policy if exists finance_manage_student_payment_plans on public.student_payment_plans;
create policy finance_manage_student_payment_plans on public.student_payment_plans
  for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive', 'finance'))
  with check (public.current_user_role() in ('ceo', 'admin', 'executive', 'finance'));

drop policy if exists parent_read_linked_student_payment_plans on public.student_payment_plans;
create policy parent_read_linked_student_payment_plans on public.student_payment_plans
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and public.parent_has_student_access(student_id)
  );

-- Finance staff can reconcile submitted parent payments without receiving
-- broader administrative rights to unrelated financial records.
drop policy if exists finance_read_parent_payment_submissions on public.payments;
create policy finance_read_parent_payment_submissions on public.payments
  for select to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive', 'finance'));

drop policy if exists finance_update_parent_payment_submissions on public.payments;
create policy finance_update_parent_payment_submissions on public.payments
  for update to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive', 'finance'))
  with check (public.current_user_role() in ('ceo', 'admin', 'executive', 'finance'));
