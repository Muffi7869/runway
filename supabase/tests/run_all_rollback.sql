-- Runway Phase 3, 4, 6, and V2 database verification runner.
-- Safe to run repeatedly in the Supabase SQL Editor: every fixture and temp
-- result is inside one outer transaction. Each test deliberately raises RN001
-- to undo its inner subtransaction before recording PASS or FAIL. The final
-- RN002 error contains RUNNER REPORT and aborts the outer transaction, leaving
-- the database unchanged. Read the RN002 error text for failures-first results.
-- Check-in uses the database's Los Angeles date expression. Avoid running this
-- within a few minutes of Los Angeles midnight so one run cannot straddle dates.

begin;

create temp table test_results (
  name text not null,
  status text not null,
  detail text
);

create temp table row_counts_before (
  table_name text primary key,
  row_count bigint not null
);

insert into row_counts_before (table_name, row_count)
select 'assignments', count(*) from public.assignments
union all select 'steps', count(*) from public.steps
union all select 'blocks', count(*) from public.blocks
union all select 'sessions', count(*) from public.sessions
union all select 'session_steps', count(*) from public.session_steps
union all select 'blocked_days', count(*) from public.blocked_days
union all select 'day_capacity', count(*) from public.day_capacity
union all select 'exam_decisions', count(*) from public.exam_decisions
union all select 'classes', count(*) from public.classes
union all select 'settings', count(*) from public.settings
union all select 'google_connection', count(*) from public.google_connection
union all select 'auth.users', count(*) from auth.users;

do $test$
declare
  test_name constant text := 'save_assignment_steps: validation, ownership, history, and removal';
  owner_id constant uuid := '10000000-0000-4000-8000-000000000001';
  other_id constant uuid := '10000000-0000-4000-8000-000000000002';
  class_id constant uuid := '10000000-0000-4000-8000-000000000003';
  other_class_id constant uuid := '10000000-0000-4000-8000-000000000004';
  valid_assignment constant uuid := '10000000-0000-4000-8000-000000000010';
  valid_step constant uuid := '10000000-0000-4000-8000-000000000011';
  future_assignment constant uuid := '10000000-0000-4000-8000-000000000020';
  future_keep constant uuid := '10000000-0000-4000-8000-000000000021';
  future_remove constant uuid := '10000000-0000-4000-8000-000000000022';
  future_block constant uuid := '10000000-0000-4000-8000-000000000023';
  locked_assignment constant uuid := '10000000-0000-4000-8000-000000000030';
  locked_keep constant uuid := '10000000-0000-4000-8000-000000000031';
  locked_remove constant uuid := '10000000-0000-4000-8000-000000000032';
  locked_block constant uuid := '10000000-0000-4000-8000-000000000033';
  logged_assignment constant uuid := '10000000-0000-4000-8000-000000000040';
  logged_keep constant uuid := '10000000-0000-4000-8000-000000000041';
  logged_remove constant uuid := '10000000-0000-4000-8000-000000000042';
  logged_session constant uuid := '10000000-0000-4000-8000-000000000043';
  done_assignment constant uuid := '10000000-0000-4000-8000-000000000050';
  other_assignment constant uuid := '10000000-0000-4000-8000-000000000060';
  state text;
  message text;
  caught_detail text;
begin
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values
      ('00000000-0000-0000-0000-000000000000', owner_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
      ('00000000-0000-0000-0000-000000000000', other_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

    insert into public.classes (id, user_id, name, color) values
      (class_id, owner_id, 'Test Class A', 'blue'),
      (other_class_id, other_id, 'Test Class B', 'green');

    insert into public.assignments (
      id, user_id, class_id, title, type, deadline, spec_text, weight, status,
      ai_total_estimate_minutes
    ) values
      (valid_assignment, owner_id, class_id, 'Test Assignment A', 'assignment', now() + interval '30 days', null, 'medium', 'active', 90),
      (future_assignment, owner_id, class_id, 'Test Assignment B', 'assignment', now() + interval '30 days', null, 'medium', 'active', null),
      (locked_assignment, owner_id, class_id, 'Test Assignment C', 'assignment', now() + interval '30 days', null, 'medium', 'active', null),
      (logged_assignment, owner_id, class_id, 'Test Assignment D', 'assignment', now() + interval '30 days', null, 'medium', 'active', null),
      (done_assignment, owner_id, class_id, 'Test Assignment E', 'assignment', now() + interval '30 days', null, 'medium', 'done', null),
      (other_assignment, other_id, other_class_id, 'Test Assignment F', 'assignment', now() + interval '30 days', null, 'medium', 'active', null);

    insert into public.steps (
      id, user_id, assignment_id, name, "order", estimated_minutes, percent_done
    ) values
      (valid_step, owner_id, valid_assignment, 'Test Step A', 1, 30, 25),
      (future_keep, owner_id, future_assignment, 'Test Step B', 1, 30, 0),
      (future_remove, owner_id, future_assignment, 'Test Step C', 2, 30, 0),
      (locked_keep, owner_id, locked_assignment, 'Test Step D', 1, 30, 0),
      (locked_remove, owner_id, locked_assignment, 'Test Step E', 2, 30, 0),
      (logged_keep, owner_id, logged_assignment, 'Test Step F', 1, 30, 0),
      (logged_remove, owner_id, logged_assignment, 'Test Step G', 2, 30, 25);

    insert into public.blocks (
      id, user_id, step_id, start, "end", planned_minutes, status
    ) values
      (future_block, owner_id, future_remove, now() + interval '2 days', now() + interval '2 days 30 minutes', 30, 'planned'),
      (locked_block, owner_id, locked_remove, now() - interval '1 hour', now() - interval '30 minutes', 30, 'checked_in');

    insert into public.sessions (id, user_id, assignment_id, date, actual_minutes)
    values (logged_session, owner_id, logged_assignment, current_date - 2, 20);

    insert into public.session_steps (
      id, user_id, session_id, step_id, percent_before, percent_after
    ) values (
      '10000000-0000-4000-8000-000000000044', owner_id, logged_session,
      logged_remove, 0, 25
    );

    execute 'set local role authenticated';
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
      true
    );

    perform public.save_assignment_steps(
      valid_assignment,
      jsonb_build_array(jsonb_build_object(
        'id', valid_step, 'name', 'Test Step A revised', 'estimated_minutes', 35
      )),
      120
    );
    if not exists (
      select 1 from public.steps
      where id = valid_step and name = 'Test Step A revised'
        and estimated_minutes = 35 and percent_done = 25
    ) or not exists (
      select 1 from public.assignments
      where id = valid_assignment and ai_total_estimate_minutes = 120
    ) then
      raise exception 'valid save, AI total, or percent preservation failed';
    end if;

    perform public.save_assignment_steps(
      valid_assignment,
      jsonb_build_array(jsonb_build_object(
        'id', valid_step, 'name', 'Test Step A revised', 'estimated_minutes', 35
      )),
      null
    );
    if not exists (
      select 1 from public.assignments
      where id = valid_assignment and ai_total_estimate_minutes = 120
    ) then
      raise exception 'null AI total changed the stored total';
    end if;

    begin
      perform public.save_assignment_steps(
        valid_assignment,
        (select jsonb_agg(jsonb_build_object(
          'name', 'Test Step ' || number, 'estimated_minutes', 15
        )) from generate_series(1, 21) as number), null
      );
      raise exception '21 steps were accepted';
    exception when sqlstate 'RS003' then null;
    end;

    begin
      perform public.save_assignment_steps(
        valid_assignment,
        jsonb_build_array(jsonb_build_object('name', repeat('A', 61), 'estimated_minutes', 15)), null
      );
      raise exception '61-character name was accepted';
    exception when sqlstate 'RS003' then null;
    end;

    begin
      perform public.save_assignment_steps(
        valid_assignment,
        jsonb_build_array(jsonb_build_object('name', 'Test Step', 'estimated_minutes', 17)), null
      );
      raise exception '17 minutes were accepted';
    exception when sqlstate 'RS003' then null;
    end;

    begin
      perform public.save_assignment_steps(
        other_assignment,
        jsonb_build_array(jsonb_build_object('name', 'Test Step', 'estimated_minutes', 30)), null
      );
      raise exception 'another owner assignment was accepted';
    exception when sqlstate 'RS002' then null;
    end;

    begin
      perform public.save_assignment_steps(
        done_assignment,
        jsonb_build_array(jsonb_build_object('name', 'Test Step', 'estimated_minutes', 30)), null
      );
      raise exception 'non-active assignment was accepted';
    exception when sqlstate 'RS002' then null;
    end;

    begin
      perform public.save_assignment_steps(
        logged_assignment,
        jsonb_build_array(jsonb_build_object(
          'id', logged_keep, 'name', 'Test Step F', 'estimated_minutes', 30
        )), null
      );
      raise exception 'logged step removal was accepted';
    exception when sqlstate 'RS001' then
      get stacked diagnostics caught_detail = pg_exception_detail;
      if caught_detail <> 'Test Step G' then
        raise exception 'RS001 detail was wrong';
      end if;
    end;
    if not exists (select 1 from public.steps where id = logged_remove)
      or not exists (select 1 from public.session_steps where step_id = logged_remove) then
      raise exception 'RS001 changed protected rows';
    end if;

    perform public.save_assignment_steps(
      future_assignment,
      jsonb_build_array(jsonb_build_object(
        'id', future_keep, 'name', 'Test Step B', 'estimated_minutes', 30
      )), null
    );
    if exists (select 1 from public.steps where id = future_remove)
      or exists (select 1 from public.blocks where id = future_block) then
      raise exception 'future planned removal did not remove step and block';
    end if;

    begin
      perform public.save_assignment_steps(
        locked_assignment,
        jsonb_build_array(jsonb_build_object(
          'id', locked_keep, 'name', 'Test Step D', 'estimated_minutes', 30
        )), null
      );
      raise exception 'checked-in step removal was accepted';
    exception when sqlstate 'RS004' then
      get stacked diagnostics caught_detail = pg_exception_detail;
      if caught_detail <> 'Test Step E' then
        raise exception 'RS004 detail was wrong';
      end if;
    end;
    if not exists (select 1 from public.steps where id = locked_remove)
      or not exists (select 1 from public.blocks where id = locked_block) then
      raise exception 'RS004 changed protected rows';
    end if;

    raise exception using errcode = 'RN001', message = 'test ok';
  exception
    when sqlstate 'RN001' then
      insert into test_results values (test_name, 'PASS', null);
      raise notice 'PASS %', test_name;
    when others then
      get stacked diagnostics state = returned_sqlstate, message = message_text;
      insert into test_results values (test_name, 'FAIL', state || ': ' || message);
      raise notice 'FAIL %: %: %', test_name, state, message;
  end;
end;
$test$;

do $test$
declare
  test_name constant text := 'replace_planned_blocks: diff, history, identity, lock, and service role';
  owner_id constant uuid := '20000000-0000-4000-8000-000000000001';
  class_id constant uuid := '20000000-0000-4000-8000-000000000002';
  active_assignment constant uuid := '20000000-0000-4000-8000-000000000003';
  done_assignment constant uuid := '20000000-0000-4000-8000-000000000004';
  active_step constant uuid := '20000000-0000-4000-8000-000000000005';
  done_step constant uuid := '20000000-0000-4000-8000-000000000006';
  matching_block constant uuid := '20000000-0000-4000-8000-000000000010';
  stale_block constant uuid := '20000000-0000-4000-8000-000000000011';
  checked_block constant uuid := '20000000-0000-4000-8000-000000000012';
  missed_block constant uuid := '20000000-0000-4000-8000-000000000013';
  started_block constant uuid := '20000000-0000-4000-8000-000000000014';
  requested jsonb;
  v_now timestamptz := date_trunc('second', now());
  state text;
  message text;
begin
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', owner_id,
      'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    );
    insert into public.classes (id, user_id, name, color)
    values (class_id, owner_id, 'Test Class C', 'blue');
    insert into public.assignments (
      id, user_id, class_id, title, type, deadline, spec_text, weight, status
    ) values
      (active_assignment, owner_id, class_id, 'Test Assignment G', 'assignment', v_now + interval '30 days', null, 'medium', 'active'),
      (done_assignment, owner_id, class_id, 'Test Assignment H', 'assignment', v_now + interval '30 days', null, 'medium', 'done');
    insert into public.steps (
      id, user_id, assignment_id, name, "order", estimated_minutes, percent_done
    ) values
      (active_step, owner_id, active_assignment, 'Test Step H', 1, 60, 0),
      (done_step, owner_id, done_assignment, 'Test Step I', 1, 60, 0);
    insert into public.blocks (
      id, user_id, step_id, start, "end", planned_minutes, google_event_id, status
    ) values
      (matching_block, owner_id, active_step, v_now + interval '1 day', v_now + interval '1 day 1 hour', 60, 'test-event-kept', 'planned'),
      (stale_block, owner_id, active_step, v_now + interval '2 days', v_now + interval '2 days 1 hour', 60, 'test-event-stale', 'planned'),
      (checked_block, owner_id, active_step, v_now + interval '3 days', v_now + interval '3 days 1 hour', 60, 'test-event-checked', 'checked_in'),
      (missed_block, owner_id, active_step, v_now + interval '4 days', v_now + interval '4 days 1 hour', 60, 'test-event-missed', 'missed'),
      (started_block, owner_id, active_step, v_now - interval '30 minutes', v_now + interval '30 minutes', 60, 'test-event-started', 'planned');

    requested := jsonb_build_array(
      jsonb_build_object('step_id', active_step, 'start', v_now + interval '1 day', 'end', v_now + interval '1 day 1 hour', 'planned_minutes', 60),
      jsonb_build_object('step_id', active_step, 'start', v_now + interval '5 days', 'end', v_now + interval '5 days 1 hour', 'planned_minutes', 60)
    );

    execute 'set local role authenticated';
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
      true
    );

    perform public.replace_planned_blocks(v_now, requested);
    perform public.replace_planned_blocks(v_now, requested);

    if not exists (
      select 1 from public.blocks
      where id = matching_block and google_event_id = 'test-event-kept'
    ) or exists (select 1 from public.blocks where id = stale_block)
      or not exists (select 1 from public.blocks where id = checked_block and status = 'checked_in')
      or not exists (select 1 from public.blocks where id = missed_block and status = 'missed')
      or not exists (select 1 from public.blocks where id = started_block and status = 'planned')
      or (select count(*) from public.blocks where user_id = owner_id and status = 'planned' and start > v_now) <> 2 then
      raise exception 'diff or protected-history behavior was wrong';
    end if;

    if not exists (
      select 1 from pg_locks
      where locktype = 'advisory' and pid = pg_backend_pid() and granted
    ) then
      raise exception 'owner advisory lock was not held';
    end if;

    begin
      perform public.replace_planned_blocks(
        v_now, jsonb_build_array(jsonb_build_object(
          'step_id', done_step, 'start', v_now + interval '6 days',
          'end', v_now + interval '6 days 1 hour', 'planned_minutes', 60
        ))
      );
      raise exception 'non-active step was accepted';
    exception when others then
      if sqlerrm <> 'step must belong to an active assignment' then raise; end if;
    end;

    begin
      perform public.replace_planned_blocks(v_now, '[]'::jsonb, '20000000-0000-4000-8000-000000000099');
      raise exception 'mismatching owner was accepted';
    exception when others then
      if sqlerrm <> 'owner does not match authenticated user' then raise; end if;
    end;

    begin
      perform set_config('request.jwt.claims', '{}', true);
      perform public.replace_planned_blocks(v_now, '[]'::jsonb);
      raise exception 'missing identity was accepted';
    exception when others then
      if sqlerrm <> 'an authenticated owner is required' then raise; end if;
    end;

    execute 'set local role service_role';
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    perform public.replace_planned_blocks(v_now, requested, owner_id);

    raise exception using errcode = 'RN001', message = 'test ok';
  exception
    when sqlstate 'RN001' then
      insert into test_results values (test_name, 'PASS', null);
      raise notice 'PASS %', test_name;
    when others then
      get stacked diagnostics state = returned_sqlstate, message = message_text;
      insert into test_results values (test_name, 'FAIL', state || ': ' || message);
      raise notice 'FAIL %: %: %', test_name, state, message;
  end;
end;
$test$;

do $test$
<<save_checkin>>
declare
  test_name constant text := 'save_checkin: daily replacement, progress, blocks, validation, and class ids';
  owner_id constant uuid := '30000000-0000-4000-8000-000000000001';
  other_id constant uuid := '30000000-0000-4000-8000-000000000002';
  class_id constant uuid := '30000000-0000-4000-8000-000000000003';
  other_class_id constant uuid := '30000000-0000-4000-8000-000000000004';
  assignment_id constant uuid := '30000000-0000-4000-8000-000000000010';
  second_assignment constant uuid := '30000000-0000-4000-8000-000000000011';
  done_assignment constant uuid := '30000000-0000-4000-8000-000000000012';
  other_assignment constant uuid := '30000000-0000-4000-8000-000000000013';
  step_id constant uuid := '30000000-0000-4000-8000-000000000020';
  second_step constant uuid := '30000000-0000-4000-8000-000000000021';
  done_step constant uuid := '30000000-0000-4000-8000-000000000022';
  other_step constant uuid := '30000000-0000-4000-8000-000000000023';
  planned_block constant uuid := '30000000-0000-4000-8000-000000000030';
  missed_block constant uuid := '30000000-0000-4000-8000-000000000031';
  other_block constant uuid := '30000000-0000-4000-8000-000000000032';
  result jsonb;
  session_id uuid;
  state text;
  message text;
begin
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values
      ('00000000-0000-0000-0000-000000000000', owner_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
      ('00000000-0000-0000-0000-000000000000', other_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
    insert into public.classes (id, user_id, name, color) values
      (class_id, owner_id, 'Test Class D', 'blue'),
      (other_class_id, other_id, 'Test Class E', 'green');
    insert into public.assignments (
      id, user_id, class_id, title, type, deadline, spec_text, weight, status
    ) values
      (assignment_id, owner_id, class_id, 'Test Assignment I', 'assignment', now() + interval '30 days', null, 'medium', 'active'),
      (second_assignment, owner_id, class_id, 'Test Assignment J', 'assignment', now() + interval '30 days', null, 'medium', 'active'),
      (done_assignment, owner_id, class_id, 'Test Assignment K', 'assignment', now() + interval '30 days', null, 'medium', 'done'),
      (other_assignment, other_id, other_class_id, 'Test Assignment L', 'assignment', now() + interval '30 days', null, 'medium', 'active');
    insert into public.steps (
      id, user_id, assignment_id, name, "order", estimated_minutes, percent_done
    ) values
      (step_id, owner_id, assignment_id, 'Test Step J', 1, 100, 0),
      (second_step, owner_id, second_assignment, 'Test Step K', 1, 60, 0),
      (done_step, owner_id, done_assignment, 'Test Step L', 1, 60, 0),
      (other_step, other_id, other_assignment, 'Test Step M', 1, 60, 0);
    insert into public.blocks (
      id, user_id, step_id, start, "end", planned_minutes, status
    ) values
      (planned_block, owner_id, step_id, now() + interval '1 hour', now() + interval '2 hours', 60, 'planned'),
      (missed_block, owner_id, step_id, now() - interval '2 hours', now() - interval '1 hour', 60, 'missed'),
      (other_block, other_id, other_step, now() + interval '1 hour', now() + interval '2 hours', 60, 'planned');

    execute 'set local role authenticated';
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
      true
    );

    result := public.save_checkin(
      jsonb_build_array(jsonb_build_object(
        'assignment_id', assignment_id, 'actual_minutes', 30,
        'steps', jsonb_build_array(jsonb_build_object('step_id', step_id, 'percent_after', 25))
      )), array[planned_block]
    );
    if result -> 'class_ids' <> jsonb_build_array(class_id)
      or (select count(*) from public.sessions where public.sessions.assignment_id = save_checkin.assignment_id) <> 1
      or not exists (
        select 1 from public.sessions
        where public.sessions.assignment_id = save_checkin.assignment_id
          and date = (now() at time zone 'America/Los_Angeles')::date
          and actual_minutes = 30
      )
      or not exists (
        select 1 from public.steps where id = step_id and percent_done = 25
      )
      or not exists (
        select 1 from public.blocks where id = planned_block and status = 'checked_in'
      ) then
      raise exception 'first check-in or class_ids was wrong';
    end if;

    select id into session_id from public.sessions
    where public.sessions.assignment_id = save_checkin.assignment_id;

    result := public.save_checkin(
      jsonb_build_array(jsonb_build_object(
        'assignment_id', assignment_id, 'actual_minutes', 45,
        'steps', jsonb_build_array(jsonb_build_object('step_id', step_id, 'percent_after', 50))
      )), array[missed_block]
    );
    if (select count(*) from public.sessions where public.sessions.assignment_id = save_checkin.assignment_id) <> 1
      or not exists (
        select 1 from public.sessions where id = session_id and actual_minutes = 45
      )
      or not exists (
        select 1 from public.session_steps
        where public.session_steps.session_id = save_checkin.session_id
          and public.session_steps.step_id = save_checkin.step_id
          and percent_before = 0 and percent_after = 50
      )
      or not exists (
        select 1 from public.blocks where id = missed_block and status = 'checked_in'
      ) then
      raise exception 'same-day replacement or missed check-in was wrong';
    end if;

    begin
      perform public.save_checkin(
        jsonb_build_array(jsonb_build_object(
          'assignment_id', assignment_id, 'actual_minutes', 99,
          'steps', jsonb_build_array(jsonb_build_object('step_id', step_id, 'percent_after', 25))
        )), '{}'::uuid[]
      );
      raise exception 'lower progress was accepted';
    exception when sqlstate 'RC001' then null;
    end;
    if not exists (select 1 from public.sessions where id = session_id and actual_minutes = 45)
      or not exists (select 1 from public.steps where id = step_id and percent_done = 50) then
      raise exception 'RC001 made a partial write';
    end if;

    begin
      perform public.save_checkin(
        jsonb_build_array(jsonb_build_object(
          'assignment_id', assignment_id, 'actual_minutes', 10,
          'steps', jsonb_build_array(jsonb_build_object('step_id', second_step, 'percent_after', 25))
        )), '{}'::uuid[]
      );
      raise exception 'another assignment step was accepted';
    exception when sqlstate 'RC002' then null;
    end;
    begin
      perform public.save_checkin(
        jsonb_build_array(jsonb_build_object(
          'assignment_id', done_assignment, 'actual_minutes', 10,
          'steps', jsonb_build_array(jsonb_build_object('step_id', done_step, 'percent_after', 25))
        )), '{}'::uuid[]
      );
      raise exception 'non-active assignment was accepted';
    exception when sqlstate 'RC002' then null;
    end;
    begin
      perform public.save_checkin(
        jsonb_build_array(jsonb_build_object(
          'assignment_id', assignment_id, 'actual_minutes', 10, 'steps', '[]'::jsonb
        )), array[other_block]
      );
      raise exception 'another owner block was accepted';
    exception when sqlstate 'RC002' then null;
    end;

    begin
      perform public.save_checkin(
        jsonb_build_array(jsonb_build_object(
          'assignment_id', assignment_id, 'actual_minutes', 721, 'steps', '[]'::jsonb
        )), '{}'::uuid[]
      );
      raise exception '721 minutes were accepted';
    exception when sqlstate 'RC003' then null;
    end;
    begin
      perform public.save_checkin(
        jsonb_build_array(jsonb_build_object(
          'assignment_id', assignment_id, 'actual_minutes', 10,
          'steps', jsonb_build_array(
            jsonb_build_object('step_id', step_id, 'percent_after', 75),
            jsonb_build_object('step_id', step_id, 'percent_after', 75)
          )
        )), '{}'::uuid[]
      );
      raise exception 'duplicate step ids were accepted';
    exception when sqlstate 'RC003' then null;
    end;

    raise exception using errcode = 'RN001', message = 'test ok';
  exception
    when sqlstate 'RN001' then
      insert into test_results values (test_name, 'PASS', null);
      raise notice 'PASS %', test_name;
    when others then
      get stacked diagnostics state = returned_sqlstate, message = message_text;
      insert into test_results values (test_name, 'FAIL', state || ': ' || message);
      raise notice 'FAIL %: %: %', test_name, state, message;
  end;
end;
$test$;

do $test$
declare
  test_name constant text := 'policies and constraints: owner, stranger, anon, and uniqueness';
  owner_id constant uuid := '40000000-0000-4000-8000-000000000001';
  stranger_id constant uuid := '40000000-0000-4000-8000-000000000002';
  class_id constant uuid := '40000000-0000-4000-8000-000000000003';
  assignment_id constant uuid := '40000000-0000-4000-8000-000000000004';
  own_delete_step constant uuid := '40000000-0000-4000-8000-000000000010';
  protected_step constant uuid := '40000000-0000-4000-8000-000000000011';
  own_delete_block constant uuid := '40000000-0000-4000-8000-000000000012';
  protected_block constant uuid := '40000000-0000-4000-8000-000000000013';
  own_delete_day constant uuid := '40000000-0000-4000-8000-000000000014';
  protected_day constant uuid := '40000000-0000-4000-8000-000000000015';
  session_id constant uuid := '40000000-0000-4000-8000-000000000020';
  session_step_id constant uuid := '40000000-0000-4000-8000-000000000021';
  affected integer;
  visible integer;
  state text;
  message text;
begin
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values
      ('00000000-0000-0000-0000-000000000000', owner_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
      ('00000000-0000-0000-0000-000000000000', stranger_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
    insert into public.classes (id, user_id, name, color)
    values (class_id, owner_id, 'Test Class F', 'blue');
    insert into public.assignments (
      id, user_id, class_id, title, type, deadline, spec_text, weight, status
    ) values (
      assignment_id, owner_id, class_id, 'Test Assignment M', 'assignment',
      now() + interval '30 days', null, 'medium', 'active'
    );
    insert into public.steps (
      id, user_id, assignment_id, name, "order", estimated_minutes, percent_done
    ) values
      (own_delete_step, owner_id, assignment_id, 'Test Step N', 1, 30, 0),
      (protected_step, owner_id, assignment_id, 'Test Step O', 2, 30, 25);
    insert into public.blocks (
      id, user_id, step_id, start, "end", planned_minutes, status
    ) values
      (own_delete_block, owner_id, protected_step, now() + interval '1 day', now() + interval '1 day 30 minutes', 30, 'planned'),
      (protected_block, owner_id, protected_step, now() + interval '2 days', now() + interval '2 days 30 minutes', 30, 'planned');
    insert into public.blocked_days (id, user_id, date, reason) values
      (own_delete_day, owner_id, current_date + 10, 'other'),
      (protected_day, owner_id, current_date + 11, 'travel');
    insert into public.sessions (id, user_id, assignment_id, date, actual_minutes)
    values (session_id, owner_id, assignment_id, current_date - 5, 20);
    insert into public.session_steps (
      id, user_id, session_id, step_id, percent_before, percent_after
    ) values (session_step_id, owner_id, session_id, protected_step, 0, 25);

    execute 'set local role authenticated';
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', stranger_id, 'role', 'authenticated')::text,
      true
    );
    select count(*) into visible from public.steps where user_id = owner_id;
    if visible <> 0 then raise exception 'stranger read owner steps'; end if;
    select count(*) into visible from public.blocks where user_id = owner_id;
    if visible <> 0 then raise exception 'stranger read owner blocks'; end if;
    select count(*) into visible from public.blocked_days where user_id = owner_id;
    if visible <> 0 then raise exception 'stranger read owner blocked days'; end if;
    delete from public.steps where id = protected_step;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'stranger deleted owner step'; end if;
    delete from public.blocks where id = protected_block;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'stranger deleted owner block'; end if;
    delete from public.blocked_days where id = protected_day;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'stranger deleted owner blocked day'; end if;

    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
      true
    );
    delete from public.steps where id = own_delete_step;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'owner could not delete own step'; end if;
    delete from public.blocks where id = own_delete_block;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'owner could not delete own block'; end if;
    delete from public.blocked_days where id = own_delete_day;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'owner could not delete own blocked day'; end if;

    begin
      insert into public.sessions (user_id, assignment_id, date, actual_minutes)
      values (owner_id, assignment_id, current_date - 5, 30);
      raise exception 'duplicate session was accepted';
    exception when unique_violation then null;
    end;
    begin
      insert into public.session_steps (
        user_id, session_id, step_id, percent_before, percent_after
      ) values (owner_id, session_id, protected_step, 25, 50);
      raise exception 'duplicate session step was accepted';
    exception when unique_violation then null;
    end;
    begin
      insert into public.blocked_days (user_id, date, reason)
      values (owner_id, current_date + 11, 'sick');
      raise exception 'duplicate blocked day was accepted';
    exception when unique_violation then null;
    end;

    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      select count(*) into visible from public.assignments where id = assignment_id;
      if visible <> 0 then raise exception 'anon read owner data'; end if;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.save_assignment_steps(
        assignment_id,
        jsonb_build_array(jsonb_build_object('name', 'Test Step', 'estimated_minutes', 30)), null
      );
      raise exception 'anon called save_assignment_steps';
    exception when insufficient_privilege then null;
    end;

    raise exception using errcode = 'RN001', message = 'test ok';
  exception
    when sqlstate 'RN001' then
      insert into test_results values (test_name, 'PASS', null);
      raise notice 'PASS %', test_name;
    when others then
      get stacked diagnostics state = returned_sqlstate, message = message_text;
      insert into test_results values (test_name, 'FAIL', state || ': ' || message);
      raise notice 'FAIL %: %: %', test_name, state, message;
  end;
end;
$test$;

do $test$
declare
  test_name constant text := 'day_capacity: owner CRUD, isolation, anon, uniqueness, and checks';
  owner_id constant uuid := '50000000-0000-4000-8000-000000000001';
  stranger_id constant uuid := '50000000-0000-4000-8000-000000000002';
  row_id constant uuid := '50000000-0000-4000-8000-000000000003';
  protected_id constant uuid := '50000000-0000-4000-8000-000000000004';
  affected integer;
  visible integer;
  state text;
  message text;
begin
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values
      ('00000000-0000-0000-0000-000000000000', owner_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
      ('00000000-0000-0000-0000-000000000000', stranger_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

    execute 'set local role authenticated';
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
      true
    );

    insert into public.day_capacity (id, user_id, date, level)
    values (row_id, owner_id, date '2026-11-01', 'light');
    update public.day_capacity set level = 'heavy' where id = row_id;
    if not exists (
      select 1 from public.day_capacity where id = row_id and level = 'heavy'
    ) then
      raise exception 'owner insert or update failed';
    end if;
    delete from public.day_capacity where id = row_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'owner delete failed'; end if;

    insert into public.day_capacity (id, user_id, date, level)
    values (protected_id, owner_id, date '2026-11-02', 'normal');

    begin
      insert into public.day_capacity (user_id, date, level)
      values (owner_id, date '2026-11-02', 'light');
      raise exception 'duplicate owner date was accepted';
    exception when unique_violation then null;
    end;
    begin
      insert into public.day_capacity (user_id, date, level)
      values (owner_id, date '2026-11-03', 'impossible');
      raise exception 'invalid level was accepted';
    exception when check_violation then null;
    end;
    begin
      insert into public.day_capacity (user_id, date, level, custom_minutes)
      values (owner_id, date '2026-11-04', 'custom', 1441);
      raise exception 'invalid custom minutes were accepted';
    exception when check_violation then null;
    end;

    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', stranger_id, 'role', 'authenticated')::text,
      true
    );
    select count(*) into visible from public.day_capacity where user_id = owner_id;
    if visible <> 0 then raise exception 'stranger read owner capacity'; end if;
    delete from public.day_capacity where id = protected_id;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'stranger deleted owner capacity'; end if;

    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      select count(*) into visible from public.day_capacity;
      if visible <> 0 then raise exception 'anon read capacity'; end if;
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.day_capacity (user_id, date, level)
      values (owner_id, date '2026-11-05', 'normal');
      raise exception 'anon inserted capacity';
    exception when insufficient_privilege then null;
    end;

    raise exception using errcode = 'RN001', message = 'test ok';
  exception
    when sqlstate 'RN001' then
      insert into test_results values (test_name, 'PASS', null);
      raise notice 'PASS %', test_name;
    when others then
      get stacked diagnostics state = returned_sqlstate, message = message_text;
      insert into test_results values (test_name, 'FAIL', state || ': ' || message);
      raise notice 'FAIL %: %: %', test_name, state, message;
  end;
end;
$test$;

do $test$
declare
  test_name constant text := 'exam_decisions: owner CRUD, isolation, anon, uniqueness, and checks';
  owner_id constant uuid := '60000000-0000-4000-8000-000000000001';
  stranger_id constant uuid := '60000000-0000-4000-8000-000000000002';
  row_id constant uuid := '60000000-0000-4000-8000-000000000003';
  protected_id constant uuid := '60000000-0000-4000-8000-000000000004';
  affected integer;
  visible integer;
  state text;
  message text;
begin
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values
      ('00000000-0000-0000-0000-000000000000', owner_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
      ('00000000-0000-0000-0000-000000000000', stranger_id,
       'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

    execute 'set local role authenticated';
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
      true
    );

    insert into public.exam_decisions (
      id, user_id, source_calendar_id, google_event_id, decision
    ) values (row_id, owner_id, 'test-calendar-a', 'test-event-a', 'protect');
    update public.exam_decisions set decision = 'not_exam' where id = row_id;
    if not exists (
      select 1 from public.exam_decisions
      where id = row_id and decision = 'not_exam'
    ) then
      raise exception 'owner insert or update failed';
    end if;
    delete from public.exam_decisions where id = row_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'owner delete failed'; end if;

    insert into public.exam_decisions (
      id, user_id, source_calendar_id, google_event_id, decision
    ) values (
      protected_id, owner_id, 'test-calendar-b', 'test-event-b', 'no_protection'
    );

    begin
      insert into public.exam_decisions (
        user_id, source_calendar_id, google_event_id, decision
      ) values (owner_id, 'test-calendar-b', 'test-event-b', 'protect');
      raise exception 'duplicate owner event was accepted';
    exception when unique_violation then null;
    end;
    begin
      insert into public.exam_decisions (
        user_id, source_calendar_id, google_event_id, decision
      ) values (owner_id, 'test-calendar-c', 'test-event-c', 'maybe');
      raise exception 'invalid decision was accepted';
    exception when check_violation then null;
    end;

    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', stranger_id, 'role', 'authenticated')::text,
      true
    );
    select count(*) into visible from public.exam_decisions where user_id = owner_id;
    if visible <> 0 then raise exception 'stranger read owner exam decisions'; end if;
    delete from public.exam_decisions where id = protected_id;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'stranger deleted owner exam decision'; end if;

    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      select count(*) into visible from public.exam_decisions;
      if visible <> 0 then raise exception 'anon read exam decisions'; end if;
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.exam_decisions (
        user_id, source_calendar_id, google_event_id, decision
      ) values (owner_id, 'test-calendar-d', 'test-event-d', 'protect');
      raise exception 'anon inserted exam decision';
    exception when insufficient_privilege then null;
    end;

    raise exception using errcode = 'RN001', message = 'test ok';
  exception
    when sqlstate 'RN001' then
      insert into test_results values (test_name, 'PASS', null);
      raise notice 'PASS %', test_name;
    when others then
      get stacked diagnostics state = returned_sqlstate, message = message_text;
      insert into test_results values (test_name, 'FAIL', state || ': ' || message);
      raise notice 'FAIL %: %: %', test_name, state, message;
  end;
end;
$test$;

do $test$
declare
  test_name constant text := 'V2 settings and calendar columns: constraints, defaults, and arrays';
  owner_id constant uuid := '70000000-0000-4000-8000-000000000001';
  settings_id constant uuid := '70000000-0000-4000-8000-000000000002';
  connection_id constant uuid := '70000000-0000-4000-8000-000000000003';
  state text;
  message text;
begin
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', owner_id,
      'authenticated', 'authenticated', null, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    );
    insert into public.settings (
      id, user_id, study_window_start, study_window_end,
      min_block_minutes, max_block_minutes, buffer_days, timezone
    ) values (
      settings_id, owner_id, time '08:00', time '22:00', 30, 120, 2,
      'America/Los_Angeles'
    );

    begin
      update public.settings
      set capacity_light_minutes = 300, capacity_normal_minutes = 240
      where id = settings_id;
      raise exception 'light greater than normal was accepted';
    exception when check_violation then null;
    end;
    begin
      update public.settings set capacity_heavy_minutes = 1441
      where id = settings_id;
      raise exception 'heavy above 1440 was accepted';
    exception when check_violation then null;
    end;
    begin
      update public.settings set weekend_window_start = time '09:00'
      where id = settings_id;
      raise exception 'one weekend bound was accepted';
    exception when check_violation then null;
    end;
    begin
      update public.settings
      set weekend_window_start = time '18:00', weekend_window_end = time '10:00'
      where id = settings_id;
      raise exception 'reversed weekend window was accepted';
    exception when check_violation then null;
    end;

    insert into public.google_connection (
      id, user_id, refresh_token_encrypted, granted_scopes, status
    ) values (
      connection_id, owner_id, 'test-ciphertext', 'test-scope', 'connected'
    );
    if not exists (
      select 1 from public.google_connection
      where id = connection_id
        and exam_calendar_ids = '{}'::text[]
        and visible_calendar_ids = '{}'::text[]
        and events_calendar_id is null
    ) then
      raise exception 'new calendar columns did not use safe defaults';
    end if;
    update public.google_connection
    set exam_calendar_ids = array['test-calendar-a'],
        visible_calendar_ids = array['test-calendar-b']
    where id = connection_id;
    if not exists (
      select 1 from public.google_connection
      where id = connection_id
        and exam_calendar_ids = array['test-calendar-a']
        and visible_calendar_ids = array['test-calendar-b']
    ) then
      raise exception 'calendar arrays did not store identifiers';
    end if;

    raise exception using errcode = 'RN001', message = 'test ok';
  exception
    when sqlstate 'RN001' then
      insert into test_results values (test_name, 'PASS', null);
      raise notice 'PASS %', test_name;
    when others then
      get stacked diagnostics state = returned_sqlstate, message = message_text;
      insert into test_results values (test_name, 'FAIL', state || ': ' || message);
      raise notice 'FAIL %: %: %', test_name, state, message;
  end;
end;
$test$;

do $final$
declare
  before_row record;
  after_count bigint;
  passed integer;
  failed integer;
  report text;
begin
  for before_row in select * from row_counts_before order by table_name loop
    if before_row.table_name = 'auth.users' then
      select count(*) into after_count from auth.users;
    else
      execute format('select count(*) from public.%I', before_row.table_name)
      into after_count;
    end if;

    insert into test_results (name, status, detail) values (
      'database unchanged: ' || before_row.table_name,
      case when after_count = before_row.row_count then 'PASS' else 'FAIL' end,
      case when after_count = before_row.row_count then null
        else format('before %s, after %s', before_row.row_count, after_count)
      end
    );
  end loop;

  select count(*) filter (where status = 'PASS'),
         count(*) filter (where status = 'FAIL')
  into passed, failed
  from test_results;

  select 'RUNNER REPORT' || E'\n' ||
    string_agg(
      status || ' | ' || name || coalesce(' | ' || detail, ''),
      E'\n' order by case status when 'FAIL' then 0 else 1 end, name
    ) || E'\n' || format('SUMMARY: %s passed, %s failed', passed, failed)
  into report
  from test_results;

  raise exception using errcode = 'RN002', message = report;
end;
$final$;
