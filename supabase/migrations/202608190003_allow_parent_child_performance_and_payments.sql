-- A parent may see academic and payment data only for children linked through
-- parent_students. Recreate these policies after legacy policy resets so the
-- parent portal works consistently in every deployed environment.

alter table public.grades enable row level security;
alter table public.attendance enable row level security;
alter table public.payments enable row level security;

drop policy if exists parent_read_linked_grades on public.grades;
create policy parent_read_linked_grades on public.grades
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and public.parent_has_student_access(student_id)
  );

drop policy if exists parent_read_linked_attendance on public.attendance;
create policy parent_read_linked_attendance on public.attendance
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and public.parent_has_student_access(student_id)
  );

drop policy if exists parent_read_linked_payments on public.payments;
create policy parent_read_linked_payments on public.payments
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and public.parent_has_student_access(student_id)
  );

drop policy if exists parent_submit_linked_payments on public.payments;
create policy parent_submit_linked_payments on public.payments
  for insert to authenticated
  with check (
    public.current_user_role() = 'parent'
    and submitted_by = auth.uid()
    and payment_status::text = 'pending'
    and payment_method::text in ('bank_transfer', 'opay', 'palmpay')
    and receipt_path like (auth.uid()::text || '/%')
    and public.parent_has_student_access(student_id)
  );
