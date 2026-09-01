-- Provide fixed term options for grade entry forms.
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  term_name text not null unique,
  created_at timestamp with time zone not null default now()
);

-- Backward compatibility: some projects already have public.terms without
-- sort_order. Add it safely before seeding.
alter table public.terms
  add column if not exists sort_order integer;

alter table public.terms enable row level security;

drop policy if exists terms_read_authenticated on public.terms;
create policy terms_read_authenticated
  on public.terms
  for select
  to authenticated
  using (true);

-- Seed fixed term options without relying on a pre-existing unique
-- constraint (older projects may not have one on term_name).
update public.terms
set sort_order = case lower(trim(term_name))
  when 'first term' then 1
  when 'second term' then 2
  when 'third term' then 3
  else sort_order
end;

do $$
declare
  has_session_id boolean;
  v_session_id uuid;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'terms'
      and column_name = 'session_id'
  )
  into has_session_id;

  if has_session_id then
    begin
      select public.get_current_academic_session_id()
      into v_session_id;
    exception when undefined_function then
      v_session_id := null;
    end;

    if v_session_id is null then
      begin
        execute 'select id from public.academic_sessions where is_current = true order by created_at desc limit 1'
          into v_session_id;
      exception when undefined_table then
        v_session_id := null;
      end;
    end if;

    if v_session_id is null then
      begin
        execute 'select id from public.academic_sessions order by created_at desc limit 1'
          into v_session_id;
      exception when undefined_table then
        v_session_id := null;
      end;
    end if;

    if v_session_id is null then
      raise exception 'Unable to seed terms because public.terms.session_id is required but no academic session exists.';
    end if;

    update public.terms
    set session_id = v_session_id
    where session_id is null;

    insert into public.terms (session_id, term_name, sort_order)
    select v_session_id, 'First Term', 1
    where not exists (
      select 1
      from public.terms
      where lower(trim(term_name)) = 'first term'
    );

    insert into public.terms (session_id, term_name, sort_order)
    select v_session_id, 'Second Term', 2
    where not exists (
      select 1
      from public.terms
      where lower(trim(term_name)) = 'second term'
    );

    insert into public.terms (session_id, term_name, sort_order)
    select v_session_id, 'Third Term', 3
    where not exists (
      select 1
      from public.terms
      where lower(trim(term_name)) = 'third term'
    );
  else
    insert into public.terms (term_name, sort_order)
    select 'First Term', 1
    where not exists (
      select 1
      from public.terms
      where lower(trim(term_name)) = 'first term'
    );

    insert into public.terms (term_name, sort_order)
    select 'Second Term', 2
    where not exists (
      select 1
      from public.terms
      where lower(trim(term_name)) = 'second term'
    );

    insert into public.terms (term_name, sort_order)
    select 'Third Term', 3
    where not exists (
      select 1
      from public.terms
      where lower(trim(term_name)) = 'third term'
    );
  end if;
end $$;

-- Enforce deterministic ordering after seed/backfill.
update public.terms
set sort_order = case lower(trim(term_name))
  when 'first term' then 1
  when 'second term' then 2
  when 'third term' then 3
  else sort_order
end
where sort_order is null;

create index if not exists terms_sort_order_idx
  on public.terms (sort_order)
  where sort_order is not null;
