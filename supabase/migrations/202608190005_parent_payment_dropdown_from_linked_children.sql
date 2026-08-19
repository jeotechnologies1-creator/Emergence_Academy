-- Parents need to read their own parent record and its child links so the
-- payment portal can build its student dropdown from parent_students directly.
alter table public.parents enable row level security;
alter table public.parent_students enable row level security;

drop policy if exists parent_read_own_parent_record on public.parents;
create policy parent_read_own_parent_record on public.parents
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and profile_id = auth.uid()
  );

drop policy if exists parent_read_own_child_links on public.parent_students;
create policy parent_read_own_child_links on public.parent_students
  for select to authenticated
  using (
    public.current_user_role() = 'parent'
    and exists (
      select 1
      from public.parents p
      where p.id = parent_students.parent_id
        and p.profile_id = auth.uid()
    )
  );
