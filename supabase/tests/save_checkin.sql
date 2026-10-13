begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000701',
  'authenticated', 'authenticated', 'phase6-checkin@example.com', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.classes (id, user_id, name, color)
values (
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000701',
  'Test Class B', 'green'
);

insert into public.assignments (
  id, user_id, class_id, title, type, deadline, spec_text, weight, status
) values
  (
    '00000000-0000-4000-8000-000000000703',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000702',
    'Test Assignment B', 'assignment', now() + interval '30 days', null,
    'medium', 'active'
  ),
  (
    '00000000-0000-4000-8000-000000000704',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000702',
    'Test Assignment C', 'assignment', now() + interval '30 days', null,
    'medium', 'active'
  ),
  (
    '00000000-0000-4000-8000-000000000705',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000702',
    'Test Assignment D', 'assignment', now() + interval '30 days', null,
    'medium', 'done'
  );

insert into public.steps (
  id, user_id, assignment_id, name, "order", estimated_minutes, percent_done
) values
  (
    '00000000-0000-4000-8000-000000000706',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000703',
    'Test Step B', 1, 120, 0
  ),
  (
    '00000000-0000-4000-8000-000000000707',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000704',
    'Test Step C', 1, 60, 0
  ),
  (
    '00000000-0000-4000-8000-000000000708',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000705',
    'Test Step D', 1, 60, 0
  );

insert into public.blocks (
  id, user_id, step_id, start, "end", planned_minutes, status
) values
  (
    '00000000-0000-4000-8000-000000000709',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000706',
    now() + interval '1 hour', now() + interval '2 hours', 60, 'planned'
  ),
  (
    '00000000-0000-4000-8000-000000000710',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000706',
    now() - interval '2 hours', now() - interval '1 hour', 60, 'missed'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000701","role":"authenticated"}',
  true
);

select public.save_checkin(
  '[{"assignment_id":"00000000-0000-4000-8000-000000000703","actual_minutes":30,"steps":[{"step_id":"00000000-0000-4000-8000-000000000706","percent_after":25}]}]'::jsonb,
  array['00000000-0000-4000-8000-000000000709'::uuid]
);

do $$
begin
  if (
    select count(*) = 1 and max(actual_minutes) = 30
    from public.sessions
    where assignment_id = '00000000-0000-4000-8000-000000000703'
  ) and exists (
    select 1
    from public.session_steps as recorded
    join public.sessions as session on session.id = recorded.session_id
    where session.assignment_id = '00000000-0000-4000-8000-000000000703'
      and recorded.step_id = '00000000-0000-4000-8000-000000000706'
      and recorded.percent_before = 0
      and recorded.percent_after = 25
  ) and exists (
    select 1 from public.blocks
    where id = '00000000-0000-4000-8000-000000000709'
      and status = 'checked_in'
  ) then
    raise notice 'first check-in: accepted as expected';
  else
    raise exception 'first check-in did not save expected rows';
  end if;
end;
$$;

select public.save_checkin(
  '[{"assignment_id":"00000000-0000-4000-8000-000000000703","actual_minutes":45,"steps":[{"step_id":"00000000-0000-4000-8000-000000000706","percent_after":50}]}]'::jsonb,
  array['00000000-0000-4000-8000-000000000710'::uuid]
);

do $$
begin
  if (
    select count(*) = 1 and max(actual_minutes) = 45
    from public.sessions
    where assignment_id = '00000000-0000-4000-8000-000000000703'
  ) and exists (
    select 1
    from public.session_steps as recorded
    join public.sessions as session on session.id = recorded.session_id
    where session.assignment_id = '00000000-0000-4000-8000-000000000703'
      and recorded.step_id = '00000000-0000-4000-8000-000000000706'
      and recorded.percent_before = 0
      and recorded.percent_after = 50
  ) and exists (
    select 1 from public.steps
    where id = '00000000-0000-4000-8000-000000000706'
      and percent_done = 50
  ) and exists (
    select 1 from public.blocks
    where id = '00000000-0000-4000-8000-000000000710'
      and status = 'checked_in'
  ) then
    raise notice 'same-day replacement and missed block: accepted as expected';
  else
    raise exception 'same-day replacement did not preserve expected state';
  end if;
end;
$$;

do $$
declare
  caught_state text;
  caught_detail text;
begin
  begin
    perform public.save_checkin(
      '[{"assignment_id":"00000000-0000-4000-8000-000000000703","actual_minutes":99,"steps":[{"step_id":"00000000-0000-4000-8000-000000000706","percent_after":25}]}]'::jsonb,
      '{}'::uuid[]
    );
    raise exception 'lower percent was not rejected';
  exception when sqlstate 'RC001' then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_detail = pg_exception_detail;
    raise notice 'lower percent: rejected as expected (% detail %)',
      caught_state, coalesce(caught_detail, '(none)');
  end;

  if not exists (
    select 1 from public.sessions
    where assignment_id = '00000000-0000-4000-8000-000000000703'
      and actual_minutes = 45
  ) or not exists (
    select 1 from public.steps
    where id = '00000000-0000-4000-8000-000000000706'
      and percent_done = 50
  ) then
    raise exception 'lower percent failure changed saved state';
  end if;
end;
$$;

do $$
declare
  caught_state text;
  caught_detail text;
begin
  begin
    perform public.save_checkin(
      '[{"assignment_id":"00000000-0000-4000-8000-000000000703","actual_minutes":30,"steps":[{"step_id":"00000000-0000-4000-8000-000000000707","percent_after":25}]}]'::jsonb,
      '{}'::uuid[]
    );
    raise exception 'step from another assignment was not rejected';
  exception when sqlstate 'RC002' then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_detail = pg_exception_detail;
    raise notice 'step from another assignment: rejected as expected (% detail %)',
      caught_state, coalesce(caught_detail, '(none)');
  end;
end;
$$;

do $$
declare
  caught_state text;
  caught_detail text;
begin
  begin
    perform public.save_checkin(
      '[{"assignment_id":"00000000-0000-4000-8000-000000000705","actual_minutes":30,"steps":[{"step_id":"00000000-0000-4000-8000-000000000708","percent_after":25}]}]'::jsonb,
      '{}'::uuid[]
    );
    raise exception 'non-active assignment was not rejected';
  exception when sqlstate 'RC002' then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_detail = pg_exception_detail;
    raise notice 'non-active assignment: rejected as expected (% detail %)',
      caught_state, coalesce(caught_detail, '(none)');
  end;
end;
$$;

rollback;
