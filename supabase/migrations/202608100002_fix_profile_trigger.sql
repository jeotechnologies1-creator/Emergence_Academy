-- Fix the auth.users profile trigger for the current profiles schema.
-- `profiles.full_name` no longer exists: names are stored separately.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := lower(trim(coalesce(new.raw_user_meta_data ->> 'role', 'student')));
  profile_role public.user_role;
begin
  -- Do not cast arbitrary metadata directly to the enum.
  if requested_role = any(enum_range(null::public.user_role)::text[]) then
    profile_role := requested_role::public.user_role;
  else
    profile_role := 'student'::public.user_role;
  end if;

  insert into public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    phone,
    status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    profile_role,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'active'::public.account_status
  )
  on conflict (id) do update
    set email = excluded.email,
        first_name = coalesce(excluded.first_name, public.profiles.first_name),
        last_name = coalesce(excluded.last_name, public.profiles.last_name),
        phone = coalesce(excluded.phone, public.profiles.phone),
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;
