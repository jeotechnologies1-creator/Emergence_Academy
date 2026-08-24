-- Let curriculum administrators extend the subject directory used by the
-- class-subject manager without changing the public read access.
alter table public.subjects enable row level security;

drop policy if exists subjects_admin_manage on public.subjects;
create policy subjects_admin_manage on public.subjects
  for all to authenticated
  using (public.current_user_role() in ('ceo', 'admin', 'executive'))
  with check (public.current_user_role() in ('ceo', 'admin', 'executive'));
