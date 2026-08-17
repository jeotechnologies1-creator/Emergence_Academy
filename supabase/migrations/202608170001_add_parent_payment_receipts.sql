-- Parents submit payment evidence only for students linked to their own
-- parent account. Finance staff retain their existing reconciliation access.
alter table public.payments
  add column if not exists receipt_path text,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists submitted_at timestamptz;

create index if not exists payments_submitted_by_idx on public.payments (submitted_by);

alter table public.payments enable row level security;

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

-- Receipt files remain private. A parent may upload and read only files in
-- their own folder; administrators and finance staff may read them for review.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists parent_upload_payment_receipts on storage.objects;
create policy parent_upload_payment_receipts on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and public.current_user_role() = 'parent'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists parent_read_own_payment_receipts on storage.objects;
create policy parent_read_own_payment_receipts on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (
      (public.current_user_role() = 'parent' and (storage.foldername(name))[1] = auth.uid()::text)
      or public.current_user_role() in ('ceo', 'admin', 'executive', 'finance')
    )
  );

drop policy if exists parent_delete_own_failed_payment_receipts on storage.objects;
create policy parent_delete_own_failed_payment_receipts on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-receipts'
    and public.current_user_role() = 'parent'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
