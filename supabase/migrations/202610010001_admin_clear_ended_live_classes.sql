create or replace function public.clear_ended_live_classes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null or coalesce(public.current_user_role(), '') not in ('ceo', 'admin', 'executive') then
    raise exception 'Only administrators can clear ended live class history.' using errcode = '42501';
  end if;

  -- Keep attendance history while removing its reference to the class record.
  update public.attendance
     set live_class_id = null
   where live_class_id in (
     select id
       from public.live_classes
      where status = 'ended'
         or (status in ('scheduled', 'live') and ends_at <= now())
   );

  delete from public.live_classes
   where status = 'ended'
      or (status in ('scheduled', 'live') and ends_at <= now());

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.clear_ended_live_classes() from public, anon;
grant execute on function public.clear_ended_live_classes() to authenticated;
