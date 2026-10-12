begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000201',
  'authenticated', 'authenticated', 'blocks-check@example.com', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.classes (id, user_id, name, color)
values (
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000201',
  'Test Class B', 'green'
);

insert into public.assignments (
  id, user_id, class_id, title, type, deadline, spec_text, weight, status
) values
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000202',
    'Test Assignment B', 'assignment', now() + interval '30 days', null,
    'medium', 'active'
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000202',
    'Test Assignment C', 'assignment', now() + interval '30 days', null,
    'medium', 'done'
  );

insert into public.steps (
  id, user_id, assignment_id, name, "order", estimated_minutes, percent_done
) values
  (
    '00000000-0000-4000-8000-000000000205',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000203',
    'Test Step D', 1, 60, 0
  ),
  (
    '00000000-0000-4000-8000-000000000206',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000204',
    'Test Step E', 1, 60, 0
  );

insert into public.blocks (
  id, user_id, step_id, start, "end", planned_minutes, google_event_id, status
) values
  (
    '00000000-0000-4000-8000-000000000207',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000205',
    '2026-12-01 18:00:00+00', '2026-12-01 19:00:00+00', 60,
    'kept-event', 'planned'
  ),
  (
    '00000000-0000-4000-8000-000000000208',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000205',
    '2026-12-02 18:00:00+00', '2026-12-02 19:00:00+00', 60,
    'stale-event', 'planned'
  ),
  (
    '00000000-0000-4000-8000-000000000209',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000205',
    '2026-12-03 18:00:00+00', '2026-12-03 19:00:00+00', 60,
    'history-event', 'checked_in'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated"}',
  true
);

select public.replace_planned_blocks(
  '2026-11-30 00:00:00+00',
  '[
    {"step_id":"00000000-0000-4000-8000-000000000205","start":"2026-12-01T18:00:00Z","end":"2026-12-01T19:00:00Z","planned_minutes":60},
    {"step_id":"00000000-0000-4000-8000-000000000205","start":"2026-12-04T18:00:00Z","end":"2026-12-04T19:00:00Z","planned_minutes":60}
  ]'::jsonb
);

do $$
begin
  if exists (
    select 1 from public.blocks
    where id = '00000000-0000-4000-8000-000000000207'
      and google_event_id = 'kept-event'
  ) then
    raise notice 'matching planned block: kept as expected';
  else
    raise notice 'matching planned block: NOT KEPT';
  end if;

  if not exists (
    select 1 from public.blocks
    where id = '00000000-0000-4000-8000-000000000208'
  ) then
    raise notice 'stale planned block: deleted as expected';
  else
    raise notice 'stale planned block: NOT DELETED';
  end if;

  if exists (
    select 1 from public.blocks
    where id = '00000000-0000-4000-8000-000000000209'
      and status = 'checked_in'
  ) then
    raise notice 'checked-in block: kept as expected';
  else
    raise notice 'checked-in block: NOT KEPT';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.replace_planned_blocks(
      '2026-11-30 00:00:00+00',
      '[
        {"step_id":"00000000-0000-4000-8000-000000000206","start":"2026-12-05T18:00:00Z","end":"2026-12-05T19:00:00Z","planned_minutes":60}
      ]'::jsonb
    );
    raise notice 'non-active assignment step: NOT REJECTED';
  exception when others then
    if sqlerrm = 'step must belong to an active assignment' then
      raise notice 'non-active assignment step: rejected as expected';
    else
      raise notice 'non-active assignment step: UNEXPECTED error';
    end if;
  end;
end;
$$;

rollback;
