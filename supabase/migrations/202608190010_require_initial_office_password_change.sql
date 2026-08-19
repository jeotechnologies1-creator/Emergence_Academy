-- Passwords are stored only as Auth hashes and can never be displayed. This
-- flag lets the application require a staff member to replace the temporary
-- password issued by an administrator after their first sign-in.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'True when an administrator-issued temporary password must be changed by the account owner.';
