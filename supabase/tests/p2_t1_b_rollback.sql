do $$
declare
  test_user_id uuid := '00000000-0000-4000-8000-000000000021';
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
        'blocked_days',
        'google_connection'
      );

    if matching_count = 10 then
      report := report || 'RLS on ten contract tables: accepted as expected' || E'\n';
    else
      report := report || 'RLS on ten contract tables: NOT ACCEPTED' || E'\n';
    end if;
  exception when others then
    report := report || 'RLS on ten contract tables: NOT ACCEPTED' || E'\n';
  end;

  begin
    insert into public.google_connection (
      id,
      user_id,
      refresh_token_encrypted,
      granted_scopes,
      fixed_calendar_ids,
      runway_calendar_id,
      last_synced_at,
      status,
      created_at,
      updated_at
    ) values (
      '00000000-0000-4000-8000-000000000022',
      test_user_id,
      'test-ciphertext',
      'test-scope',
      array['test-fixed-calendar'],
      'test-runway-calendar',
      '2026-10-06 12:00:00+00',
      'connected',
      '2026-10-06 12:00:00+00',
      '2026-10-06 12:00:00+00'
    );
    report := report || 'valid google connection: accepted as expected' || E'\n';
  exception when others then
    report := report || 'valid google connection: NOT ACCEPTED' || E'\n';
  end;

  begin
    insert into public.google_connection (
      id,
      user_id,
      refresh_token_encrypted,
      granted_scopes,
      fixed_calendar_ids,
      status,
      created_at,
      updated_at
    ) values (
      '00000000-0000-4000-8000-000000000023',
      test_user_id,
      'test-ciphertext',
      'test-scope',
      '{}',
      'connected',
      '2026-10-06 12:00:00+00',
      '2026-10-06 12:00:00+00'
    );
    report := report || 'duplicate user connection: NOT REJECTED' || E'\n';
  exception when unique_violation then
    report := report || 'duplicate user connection: rejected as expected' || E'\n';
  end;

  begin
    update public.google_connection
    set status = 'invalid'
    where user_id = test_user_id;
    report := report || 'invalid connection status: NOT REJECTED' || E'\n';
  exception when check_violation then
    report := report || 'invalid connection status: rejected as expected' || E'\n';
  end;

  raise exception using
    message = E'Rollback-only verification report:\n' || report;
end;
$$;
