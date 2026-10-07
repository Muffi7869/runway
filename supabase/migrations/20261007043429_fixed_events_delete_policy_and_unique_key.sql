do $$
begin
  if exists (
    select 1
    from public.fixed_events
    group by user_id, source_calendar_id, google_event_id
    having count(*) > 1
  ) then
    raise exception 'fixed_events contains duplicate Google event keys';
  end if;
end
$$;

alter table public.fixed_events
  add constraint fixed_events_user_calendar_event_key
  unique (user_id, source_calendar_id, google_event_id);

create policy fixed_events_delete on public.fixed_events
for delete to authenticated
using (user_id = (select auth.uid()));
