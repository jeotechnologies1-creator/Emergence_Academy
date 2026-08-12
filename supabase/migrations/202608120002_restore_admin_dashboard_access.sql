-- Dashboard statistics query these operational tables directly. Earlier RLS
-- repairs omitted them, which made the API return an empty count (or 500 for
-- legacy policies) even to administrators. This migration is intentionally
-- read-only; it does not grant dashboard users write access.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'students', 'teachers', 'attendance', 'grades', 'payments', 'activity_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists admin_read_dashboard_records on public.%I', table_name);
    execute format(
      'create policy admin_read_dashboard_records on public.%I
       for select to authenticated
       using (public.current_user_role() in (''ceo'', ''admin'', ''executive''))',
      table_name
    );
  end loop;
end $$;
