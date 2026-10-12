begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000101',
  'authenticated', 'authenticated', 'schema-check@example.com', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.classes (id, user_id, name, color)
values (
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000101',
  'Test Class A', 'blue'
);

insert into public.assignments (
  id, user_id, class_id, title, type, deadline, spec_text, weight, status,
  ai_total_estimate_minutes
) values (
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  'Test Assignment A', 'assignment', now() + interval '30 days',
  'Fictional test specification.', 'medium', 'active', 135
);

insert into public.steps (
  id, user_id, assignment_id, name, "order", estimated_minutes, percent_done
) values
  (
    '00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000103',
    'Test Step A', 1, 45, 0
  ),
  (
    '00000000-0000-4000-8000-000000000105',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000103',
    'Test Step B', 2, 45, 0
  ),
  (
    '00000000-0000-4000-8000-000000000107',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000103',
    'Test Step C', 3, 45, 0
  );

insert into public.blocks (
  id, user_id, step_id, start, "end", planned_minutes, status
) values
  (
    '00000000-0000-4000-8000-000000000106',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000105',
    now() - interval '30 minutes', now() + interval '15 minutes', 45,
    'checked_in'
  ),
  (
    '00000000-0000-4000-8000-000000000108',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000107',
    now() + interval '2 days', now() + interval '2 days 45 minutes', 45,
    'planned'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}',
  true
);

do $$
declare
  caught_state text;
  caught_detail text;
begin
  begin
    perform public.save_assignment_steps(
      '00000000-0000-4000-8000-000000000103',
      '[
        {"id":"00000000-0000-4000-8000-000000000104","name":"Test Step A","estimated_minutes":45},
        {"id":"00000000-0000-4000-8000-000000000107","name":"Test Step C","estimated_minutes":45}
      ]'::jsonb,
      null
    );
    raise notice 'checked-in step removal: NOT REJECTED';
  exception
    when sqlstate 'RS004' then
      get stacked diagnostics
        caught_state = returned_sqlstate,
        caught_detail = pg_exception_detail;
      if caught_detail = 'Test Step B' then
        raise notice 'checked-in step removal: % with expected detail %',
          caught_state, caught_detail;
      else
        raise notice 'checked-in step removal: % with UNEXPECTED detail %',
          caught_state, caught_detail;
      end if;
    when others then
      get stacked diagnostics
        caught_state = returned_sqlstate,
        caught_detail = pg_exception_detail;
      raise notice 'checked-in step removal: UNEXPECTED % detail %',
        caught_state, coalesce(caught_detail, '(none)');
  end;
end;
$$;

do $$
begin
  begin
    perform public.save_assignment_steps(
      '00000000-0000-4000-8000-000000000103',
      '[
        {"id":"00000000-0000-4000-8000-000000000104","name":"Test Step A","estimated_minutes":45},
        {"id":"00000000-0000-4000-8000-000000000105","name":"Test Step B","estimated_minutes":45}
      ]'::jsonb,
      null
    );

    if exists (
      select 1 from public.steps
      where id = '00000000-0000-4000-8000-000000000107'
    ) or exists (
      select 1 from public.blocks
      where id = '00000000-0000-4000-8000-000000000108'
    ) then
      raise notice 'future planned step removal: NOT DELETED';
    else
      raise notice 'future planned step removal: deleted as expected';
    end if;
  exception when others then
    raise notice 'future planned step removal: NOT ACCEPTED';
  end;
end;
$$;

rollback;
