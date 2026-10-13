begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000601',
  'authenticated', 'authenticated', 'phase6-lock@example.com', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.classes (id, user_id, name, color)
values (
  '00000000-0000-4000-8000-000000000602',
  '00000000-0000-4000-8000-000000000601',
  'Test Class A', 'blue'
);

insert into public.assignments (
  id, user_id, class_id, title, type, deadline, spec_text, weight, status
) values (
  '00000000-0000-4000-8000-000000000603',
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000602',
  'Test Assignment A', 'assignment', now() + interval '30 days', null,
  'medium', 'active'
);

insert into public.steps (
  id, user_id, assignment_id, name, "order", estimated_minutes, percent_done
) values (
  '00000000-0000-4000-8000-000000000604',
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000603',
  'Test Step A', 1, 60, 0
);

insert into public.blocks (
  id, user_id, step_id, start, "end", planned_minutes, google_event_id, status
) values (
  '00000000-0000-4000-8000-000000000605',
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000604',
  '2026-12-01 18:00:00+00', '2026-12-01 19:00:00+00', 60,
  'kept-event', 'planned'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated"}',
  true
);

select public.replace_planned_blocks(
  '2026-11-30 00:00:00+00',
  '[{"step_id":"00000000-0000-4000-8000-000000000604","start":"2026-12-01T18:00:00Z","end":"2026-12-01T19:00:00Z","planned_minutes":60}]'::jsonb
);

select public.replace_planned_blocks(
  '2026-11-30 00:00:00+00',
  '[{"step_id":"00000000-0000-4000-8000-000000000604","start":"2026-12-01T18:00:00Z","end":"2026-12-01T19:00:00Z","planned_minutes":60}]'::jsonb
);

do $$
begin
  if (
    select count(*) = 1
      and max(google_event_id) = 'kept-event'
    from public.blocks
    where user_id = '00000000-0000-4000-8000-000000000601'
      and step_id = '00000000-0000-4000-8000-000000000604'
      and status = 'planned'
  ) then
    raise notice 'sequential replacement keeps matching block: accepted as expected';
  else
    raise exception 'sequential replacement did not keep matching block';
  end if;

  if exists (
    select 1
    from pg_locks
    where locktype = 'advisory'
      and pid = pg_backend_pid()
      and granted
  ) then
    raise notice 'owner advisory transaction lock: held as expected';
  else
    raise exception 'owner advisory transaction lock was not held';
  end if;
end;
$$;

do $$
declare
  caught_state text;
  caught_detail text;
begin
  begin
    perform public.replace_planned_blocks(
      '2026-11-30 00:00:00+00',
      '[]'::jsonb,
      '00000000-0000-4000-8000-000000000699'
    );
    raise exception 'mismatched owner was not rejected';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_detail = pg_exception_detail;

    if sqlerrm = 'mismatched owner was not rejected' then
      raise;
    end if;

    raise notice 'mismatched owner: rejected as expected (% detail %)',
      caught_state, coalesce(caught_detail, '(none)');
  end;
end;
$$;

select set_config('request.jwt.claims', '{}', true);

do $$
declare
  caught_state text;
  caught_detail text;
begin
  begin
    perform public.replace_planned_blocks(
      '2026-11-30 00:00:00+00',
      '[]'::jsonb
    );
    raise exception 'missing identity was not rejected';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_detail = pg_exception_detail;

    if sqlerrm = 'missing identity was not rejected' then
      raise;
    end if;

    raise notice 'missing identity: rejected as expected (% detail %)',
      caught_state, coalesce(caught_detail, '(none)');
  end;
end;
$$;

rollback;
