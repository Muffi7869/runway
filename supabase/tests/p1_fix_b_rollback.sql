do $$
declare
  test_user_id uuid := '00000000-0000-4000-8000-000000000001';
  test_class_id uuid := '00000000-0000-4000-8000-000000000002';
  test_assignment_id uuid := '00000000-0000-4000-8000-000000000003';
  test_step_id uuid := '00000000-0000-4000-8000-000000000004';
  test_session_id uuid := '00000000-0000-4000-8000-000000000005';
  report text := '';
  matching_count integer;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    test_user_id,
    'authenticated',
    'authenticated',
    'schema-check@example.com',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into public.classes (id, user_id, name, color)
  values (test_class_id, test_user_id, 'Test Class A', 'blue');

  insert into public.assignments (
    id,
    user_id,
    class_id,
    title,
    type,
    deadline,
    spec_text,
    weight,
    status,
    ai_total_estimate_minutes
  ) values (
    test_assignment_id,
    test_user_id,
    test_class_id,
    'Test Assignment A',
    'assignment',
    '2026-12-01 20:00:00+00',
    'Fictional test specification.',
    'medium',
    'active',
    60
  );

  insert into public.steps (
    id,
    user_id,
    assignment_id,
    name,
    "order",
    estimated_minutes,
    percent_done
  ) values (
    test_step_id,
    test_user_id,
    test_assignment_id,
    'Test Step A',
    1,
    60,
    0
  );

  insert into public.sessions (
    id,
    user_id,
    assignment_id,
    date,
    actual_minutes
  ) values (
    test_session_id,
    test_user_id,
    test_assignment_id,
    '2026-11-15',
    30
  );

  insert into public.settings (
    id,
    user_id,
    study_window_start,
    study_window_end,
    max_study_minutes_per_day,
    min_block_minutes,
    max_block_minutes,
    buffer_days,
    timezone,
    check_in_time
  ) values (
    '00000000-0000-4000-8000-000000000007',
    test_user_id,
    '09:00',
    '10:00',
    60,
    15,
    30,
    1,
    'America/Los_Angeles',
    '23:30'
  );

  begin
    select count(*)
    into matching_count
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name in ('step_id', 'percent_before', 'percent_after');

    if matching_count = 0 then
      report := report || 'sessions per-step columns removed: accepted as expected' || E'\n';
    else
      report := report || 'sessions per-step columns removed: NOT ACCEPTED' || E'\n';
    end if;
  exception when others then
    report := report || 'sessions per-step columns removed: NOT ACCEPTED' || E'\n';
  end;

  begin
    select count(*)
    into matching_count
    from pg_class as table_info
    join pg_namespace as schema_info
      on schema_info.oid = table_info.relnamespace
    where schema_info.nspname = 'public'
      and table_info.relkind = 'r'
      and table_info.relrowsecurity
      and table_info.relname in (
        'settings',
        'classes',
        'fixed_events',
        'assignments',
        'steps',
        'blocks',
        'sessions',
        'session_steps',
        'blocked_days'
      );

    if matching_count = 9 then
      report := report || 'RLS on nine contract tables: accepted as expected' || E'\n';
    else
      report := report || format(
        'RLS on nine contract tables: NOT ACCEPTED (%s enabled)',
        matching_count
      ) || E'\n';
    end if;
  exception when others then
    report := report || 'RLS on nine contract tables: NOT ACCEPTED' || E'\n';
  end;

  begin
    insert into public.session_steps (
      id,
      user_id,
      session_id,
      step_id,
      percent_before,
      percent_after
    ) values (
      '00000000-0000-4000-8000-000000000010',
      test_user_id,
      test_session_id,
      test_step_id,
      30,
      50
    );
    report := report || 'percent_before value 30: NOT REJECTED' || E'\n';
  exception when check_violation then
    report := report || 'percent_before value 30: rejected as expected' || E'\n';
  end;

  begin
    insert into public.session_steps (
      id,
      user_id,
      session_id,
      step_id,
      percent_before,
      percent_after
    ) values (
      '00000000-0000-4000-8000-000000000011',
      test_user_id,
      test_session_id,
      test_step_id,
      25,
      30
    );
    report := report || 'percent_after value 30: NOT REJECTED' || E'\n';
  exception when check_violation then
    report := report || 'percent_after value 30: rejected as expected' || E'\n';
  end;

  begin
    insert into public.session_steps (
      id,
      user_id,
      session_id,
      step_id,
      percent_before,
      percent_after
    ) values (
      '00000000-0000-4000-8000-000000000012',
      test_user_id,
      test_session_id,
      test_step_id,
      75,
      50
    );
    report := report || 'progress decrease: NOT REJECTED' || E'\n';
  exception when check_violation then
    report := report || 'progress decrease: rejected as expected' || E'\n';
  end;

  begin
    insert into public.session_steps (
      id,
      user_id,
      session_id,
      step_id,
      percent_before,
      percent_after
    ) values (
      '00000000-0000-4000-8000-000000000013',
      test_user_id,
      test_session_id,
      test_step_id,
      50,
      50
    );
    report := report || 'equal progress values: accepted as expected' || E'\n';
  exception when others then
    report := report || 'equal progress values: NOT ACCEPTED' || E'\n';
  end;

  begin
    insert into public.session_steps (
      id,
      user_id,
      session_id,
      step_id,
      percent_before,
      percent_after
    ) values (
      '00000000-0000-4000-8000-000000000014',
      test_user_id,
      test_session_id,
      test_step_id,
      50,
      75
    );
    report := report || 'duplicate session and step: NOT REJECTED' || E'\n';
  exception when unique_violation then
    report := report || 'duplicate session and step: rejected as expected' || E'\n';
  end;

  begin
    update public.settings
    set min_block_minutes = 14
    where user_id = test_user_id;
    report := report || 'minimum block 14 minutes: NOT REJECTED' || E'\n';
  exception when check_violation then
    report := report || 'minimum block 14 minutes: rejected as expected' || E'\n';
  end;

  begin
    update public.settings
    set min_block_minutes = 15
    where user_id = test_user_id;
    report := report || 'minimum block 15 minutes: accepted as expected' || E'\n';

    update public.settings
    set study_window_start = '09:00',
        study_window_end = '10:00',
        max_study_minutes_per_day = 60,
        min_block_minutes = 15,
        max_block_minutes = 30
    where user_id = test_user_id;
  exception when others then
    report := report || 'minimum block 15 minutes: NOT ACCEPTED' || E'\n';
  end;

  begin
    update public.settings
    set max_block_minutes = 14
    where user_id = test_user_id;
    report := report || 'maximum block below minimum: NOT REJECTED' || E'\n';
  exception when check_violation then
    report := report || 'maximum block below minimum: rejected as expected' || E'\n';
  end;

  begin
    update public.settings
    set max_block_minutes = 15
    where user_id = test_user_id;
    report := report || 'maximum block equal to minimum: accepted as expected' || E'\n';

    update public.settings
    set study_window_start = '09:00',
        study_window_end = '10:00',
        max_study_minutes_per_day = 60,
        min_block_minutes = 15,
        max_block_minutes = 30
    where user_id = test_user_id;
  exception when others then
    report := report || 'maximum block equal to minimum: NOT ACCEPTED' || E'\n';
  end;

  begin
    update public.settings
    set max_study_minutes_per_day = 29
    where user_id = test_user_id;
    report := report || 'daily maximum below maximum block: NOT REJECTED' || E'\n';
  exception when check_violation then
    report := report || 'daily maximum below maximum block: rejected as expected' || E'\n';
  end;

  begin
    update public.settings
    set max_study_minutes_per_day = 30
    where user_id = test_user_id;
    report := report || 'daily maximum equal to maximum block: accepted as expected' || E'\n';

    update public.settings
    set study_window_start = '09:00',
        study_window_end = '10:00',
        max_study_minutes_per_day = 60,
        min_block_minutes = 15,
        max_block_minutes = 30
    where user_id = test_user_id;
  exception when others then
    report := report || 'daily maximum equal to maximum block: NOT ACCEPTED' || E'\n';
  end;

  begin
    update public.settings
    set study_window_end = '09:14'
    where user_id = test_user_id;
    report := report || 'study window one minute too short: NOT REJECTED' || E'\n';
  exception when check_violation then
    report := report || 'study window one minute too short: rejected as expected' || E'\n';
  end;

  begin
    update public.settings
    set study_window_end = '09:15'
    where user_id = test_user_id;
    report := report || 'study window equal to minimum block: accepted as expected' || E'\n';

    update public.settings
    set study_window_start = '09:00',
        study_window_end = '10:00',
        max_study_minutes_per_day = 60,
        min_block_minutes = 15,
        max_block_minutes = 30
    where user_id = test_user_id;
  exception when others then
    report := report || 'study window equal to minimum block: NOT ACCEPTED' || E'\n';
  end;

  raise exception using
    message = E'Rollback-only verification report:\n' || report;
end;
$$;
