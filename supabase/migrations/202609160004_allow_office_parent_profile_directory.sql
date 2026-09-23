-- The Parent module enriches parent records from public.profiles. These
-- office roles already manage parent records; grant only the corresponding
-- parent-profile read, not broad access to student or staff profiles.
alter table public.profiles enable row level security;

drop policy if exists office_read_parent_profiles on public.profiles;
create policy office_read_parent_profiles on public.profiles
  for select to authenticated
  using (
    public.current_user_role() in ('ceo', 'admin', 'executive', 'admission')
    and role::text = 'parent'
  );
