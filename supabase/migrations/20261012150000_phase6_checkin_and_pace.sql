-- Phase 6 serializes each owner's replans with an advisory transaction lock,
-- permits an explicit owner only for service_role replans, records check-ins on
-- today's Los Angeles date, replaces same-day minutes, and preserves each
-- step's earliest percent_before value for that day.

drop function public.replace_planned_blocks(timestamptz, jsonb);

create function public.replace_planned_blocks(
  p_now timestamptz,
  p_blocks jsonb,
  p_user_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid;
  v_block jsonb;
  v_step_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_planned_numeric numeric;
begin
  if auth.uid() is not null then
    v_uid := auth.uid();

    if p_user_id is not null and p_user_id <> v_uid then
      raise exception 'owner does not match authenticated user';
    end if;
  elsif auth.role() = 'service_role' and p_user_id is not null then
    v_uid := p_user_id;
  else
    raise exception 'an authenticated owner is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  if p_now is null then
    raise exception 'planning time is required';
  end if;

  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'blocks must be an array';
  end if;

  if jsonb_array_length(p_blocks) > 2000 then
    raise exception 'provide at most 2000 blocks';
  end if;

  for v_block in
    select block_value
    from jsonb_array_elements(p_blocks) as block_rows(block_value)
  loop
    if jsonb_typeof(v_block) <> 'object'
      or not (v_block ?& array['step_id', 'start', 'end', 'planned_minutes'])
    then
      raise exception 'each block must have the required fields';
    end if;

    if jsonb_typeof(v_block -> 'step_id') <> 'string'
      or jsonb_typeof(v_block -> 'start') <> 'string'
      or jsonb_typeof(v_block -> 'end') <> 'string'
      or jsonb_typeof(v_block -> 'planned_minutes') <> 'number'
      or (v_block ->> 'planned_minutes') !~ '^[0-9]+$'
    then
      raise exception 'invalid block value';
    end if;

    begin
      v_step_id := (v_block ->> 'step_id')::uuid;
      v_start := (v_block ->> 'start')::timestamptz;
      v_end := (v_block ->> 'end')::timestamptz;
      v_planned_numeric := (v_block ->> 'planned_minutes')::numeric;
    exception
      when invalid_text_representation
        or datetime_field_overflow
        or numeric_value_out_of_range
      then
        raise exception 'invalid block value';
    end;

    if v_end <= v_start
      or v_planned_numeric < 1
      or v_planned_numeric > 2147483647
    then
      raise exception 'invalid block value';
    end if;

    if not exists (
      select 1
      from public.steps as owned_steps
      join public.assignments as owned_assignments
        on owned_assignments.id = owned_steps.assignment_id
      where owned_steps.id = v_step_id
        and owned_steps.user_id = v_uid
        and owned_assignments.user_id = v_uid
        and owned_assignments.status = 'active'
    ) then
      raise exception 'step must belong to an active assignment';
    end if;
  end loop;

  if exists (
    select 1
    from (
      select
        (block_value ->> 'step_id')::uuid as step_id,
        (block_value ->> 'start')::timestamptz as block_start,
        (block_value ->> 'end')::timestamptz as block_end
      from jsonb_array_elements(p_blocks) as block_rows(block_value)
      group by 1, 2, 3
      having count(*) > 1
    ) as duplicates
  ) then
    raise exception 'duplicate blocks are not allowed';
  end if;

  with requested as (
    select
      (block_value ->> 'step_id')::uuid as step_id,
      (block_value ->> 'start')::timestamptz as block_start,
      (block_value ->> 'end')::timestamptz as block_end
    from jsonb_array_elements(p_blocks) as block_rows(block_value)
  )
  delete from public.blocks as stale_blocks
  where stale_blocks.user_id = v_uid
    and stale_blocks.status = 'planned'
    and stale_blocks.start >= p_now
    and not exists (
      select 1
      from requested
      where requested.step_id = stale_blocks.step_id
        and requested.block_start = stale_blocks.start
        and requested.block_end = stale_blocks."end"
    );

  with requested as (
    select
      (block_value ->> 'step_id')::uuid as step_id,
      (block_value ->> 'start')::timestamptz as block_start,
      (block_value ->> 'end')::timestamptz as block_end,
      (block_value ->> 'planned_minutes')::integer as planned_minutes
    from jsonb_array_elements(p_blocks) as block_rows(block_value)
  )
  insert into public.blocks (
    user_id, step_id, start, "end", planned_minutes, status
  )
  select
    v_uid, requested.step_id, requested.block_start, requested.block_end,
    requested.planned_minutes, 'planned'
  from requested
  where not exists (
    select 1
    from public.blocks as existing_blocks
    where existing_blocks.user_id = v_uid
      and existing_blocks.step_id = requested.step_id
      and existing_blocks.start = requested.block_start
      and existing_blocks."end" = requested.block_end
  );
end;
$$;

revoke execute on function public.replace_planned_blocks(timestamptz, jsonb, uuid)
from public;
revoke execute on function public.replace_planned_blocks(timestamptz, jsonb, uuid)
from anon;
grant execute on function public.replace_planned_blocks(timestamptz, jsonb, uuid)
to authenticated;
grant execute on function public.replace_planned_blocks(timestamptz, jsonb, uuid)
to service_role;

do $$
begin
  if exists (
    select 1
    from public.sessions
    group by assignment_id, date
    having count(*) > 1
  ) then
    raise exception 'sessions has duplicate assignment and date rows';
  end if;
end;
$$;

alter table public.sessions
  add constraint sessions_assignment_id_date_key unique (assignment_id, date);

do $$
begin
  if exists (
    select 1
    from public.blocked_days
    group by user_id, date
    having count(*) > 1
  ) then
    raise exception 'blocked_days has duplicate user and date rows';
  end if;
end;
$$;

alter table public.blocked_days
  add constraint blocked_days_user_id_date_key unique (user_id, date);

create policy blocked_days_delete
on public.blocked_days
for delete
to authenticated
using (user_id = (select auth.uid()));

create function public.save_checkin(
  p_entries jsonb,
  p_block_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid;
  v_date date;
  v_entry jsonb;
  v_assignment_id uuid;
  v_assignment_ids uuid[] := '{}'::uuid[];
  v_class_id uuid;
  v_class_ids uuid[] := '{}'::uuid[];
  v_actual_numeric numeric;
  v_actual_minutes integer;
  v_step jsonb;
  v_step_id uuid;
  v_step_ids uuid[] := '{}'::uuid[];
  v_percent_numeric numeric;
  v_percent_after integer;
  v_percent_before integer;
  v_step_name text;
  v_session_id uuid;
  v_block_id uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'authentication required' using errcode = 'RC002';
  end if;

  v_date := (now() at time zone 'America/Los_Angeles')::date;

  if p_entries is null
    or jsonb_typeof(p_entries) <> 'array'
    or jsonb_array_length(p_entries) < 1
    or jsonb_array_length(p_entries) > 50
  then
    raise exception 'provide 1 to 50 check-in entries' using errcode = 'RC003';
  end if;

  if p_block_ids is null
    or cardinality(p_block_ids) > 500
    or array_position(p_block_ids, null) is not null
  then
    raise exception 'provide up to 500 valid block ids' using errcode = 'RC003';
  end if;

  for v_entry in
    select entry_value
    from jsonb_array_elements(p_entries) as entry_rows(entry_value)
  loop
    if jsonb_typeof(v_entry) <> 'object'
      or not (v_entry ?& array['assignment_id', 'actual_minutes', 'steps'])
      or jsonb_typeof(v_entry -> 'assignment_id') <> 'string'
      or jsonb_typeof(v_entry -> 'actual_minutes') <> 'number'
      or (v_entry ->> 'actual_minutes') !~ '^[0-9]+$'
      or jsonb_typeof(v_entry -> 'steps') <> 'array'
      or jsonb_array_length(v_entry -> 'steps') > 50
    then
      raise exception 'invalid check-in entry' using errcode = 'RC003';
    end if;

    begin
      v_assignment_id := (v_entry ->> 'assignment_id')::uuid;
      v_actual_numeric := (v_entry ->> 'actual_minutes')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'invalid check-in entry' using errcode = 'RC003';
    end;

    if v_actual_numeric < 0 or v_actual_numeric > 720 then
      raise exception 'actual minutes must be from 0 to 720'
        using errcode = 'RC003';
    end if;

    if v_assignment_id = any(v_assignment_ids) then
      raise exception 'duplicate assignment ids are not allowed'
        using errcode = 'RC003';
    end if;

    v_assignment_ids := array_append(v_assignment_ids, v_assignment_id);
    v_actual_minutes := v_actual_numeric::integer;

    select owned_assignments.class_id
    into v_class_id
    from public.assignments as owned_assignments
    where owned_assignments.id = v_assignment_id
      and owned_assignments.user_id = v_uid
      and owned_assignments.status = 'active'
    for update;

    if not found then
      raise exception 'assignment not found or not active'
        using errcode = 'RC002';
    end if;

    if not (v_class_id = any(v_class_ids)) then
      v_class_ids := array_append(v_class_ids, v_class_id);
    end if;

    for v_step in
      select step_value
      from jsonb_array_elements(v_entry -> 'steps') as step_rows(step_value)
    loop
      if jsonb_typeof(v_step) <> 'object'
        or not (v_step ?& array['step_id', 'percent_after'])
        or jsonb_typeof(v_step -> 'step_id') <> 'string'
        or jsonb_typeof(v_step -> 'percent_after') <> 'number'
        or (v_step ->> 'percent_after') !~ '^[0-9]+$'
      then
        raise exception 'invalid check-in step' using errcode = 'RC003';
      end if;

      begin
        v_step_id := (v_step ->> 'step_id')::uuid;
        v_percent_numeric := (v_step ->> 'percent_after')::numeric;
      exception
        when invalid_text_representation or numeric_value_out_of_range then
          raise exception 'invalid check-in step' using errcode = 'RC003';
      end;

      if v_percent_numeric not in (0, 25, 50, 75, 100) then
        raise exception 'percent must be 0, 25, 50, 75, or 100'
          using errcode = 'RC003';
      end if;

      if v_step_id = any(v_step_ids) then
        raise exception 'duplicate step ids are not allowed'
          using errcode = 'RC003';
      end if;

      v_step_ids := array_append(v_step_ids, v_step_id);
      v_percent_after := v_percent_numeric::integer;

      select owned_steps.percent_done, owned_steps.name
      into v_percent_before, v_step_name
      from public.steps as owned_steps
      where owned_steps.id = v_step_id
        and owned_steps.assignment_id = v_assignment_id
        and owned_steps.user_id = v_uid
      for update;

      if not found then
        raise exception 'step not found for assignment'
          using errcode = 'RC002';
      end if;

      if v_percent_after < v_percent_before then
        raise exception 'percent cannot be lower than saved progress'
          using errcode = 'RC001', detail = v_step_name;
      end if;
    end loop;
  end loop;

  foreach v_block_id in array p_block_ids
  loop
    if not exists (
      select 1
      from public.blocks as owned_blocks
      join public.steps as owned_steps on owned_steps.id = owned_blocks.step_id
      where owned_blocks.id = v_block_id
        and owned_blocks.user_id = v_uid
        and owned_steps.user_id = v_uid
        and owned_steps.assignment_id = any(v_assignment_ids)
        and owned_blocks.status in ('planned', 'missed', 'checked_in')
    ) then
      raise exception 'block not found for check-in' using errcode = 'RC002';
    end if;
  end loop;

  for v_entry in
    select entry_value
    from jsonb_array_elements(p_entries) as entry_rows(entry_value)
  loop
    v_assignment_id := (v_entry ->> 'assignment_id')::uuid;
    v_actual_minutes := (v_entry ->> 'actual_minutes')::integer;

    insert into public.sessions (
      user_id, assignment_id, date, actual_minutes
    ) values (
      v_uid, v_assignment_id, v_date, v_actual_minutes
    )
    on conflict (assignment_id, date)
    do update set actual_minutes = excluded.actual_minutes
    returning id into v_session_id;

    for v_step in
      select step_value
      from jsonb_array_elements(v_entry -> 'steps') as step_rows(step_value)
    loop
      v_step_id := (v_step ->> 'step_id')::uuid;
      v_percent_after := (v_step ->> 'percent_after')::integer;

      select owned_steps.percent_done
      into v_percent_before
      from public.steps as owned_steps
      where owned_steps.id = v_step_id
        and owned_steps.assignment_id = v_assignment_id
        and owned_steps.user_id = v_uid;

      if v_percent_after > v_percent_before then
        insert into public.session_steps (
          user_id, session_id, step_id, percent_before, percent_after
        ) values (
          v_uid, v_session_id, v_step_id, v_percent_before, v_percent_after
        )
        on conflict (session_id, step_id)
        do update set percent_after = excluded.percent_after;

        update public.steps as updated_steps
        set percent_done = v_percent_after
        where updated_steps.id = v_step_id
          and updated_steps.assignment_id = v_assignment_id
          and updated_steps.user_id = v_uid;
      end if;
    end loop;
  end loop;

  update public.blocks as checked_blocks
  set status = 'checked_in'
  where checked_blocks.user_id = v_uid
    and checked_blocks.id = any(p_block_ids);

  return jsonb_build_object(
    'session_date', v_date,
    'assignment_ids', to_jsonb(v_assignment_ids),
    'class_ids', to_jsonb(v_class_ids)
  );
end;
$$;

revoke execute on function public.save_checkin(jsonb, uuid[]) from public;
revoke execute on function public.save_checkin(jsonb, uuid[]) from anon;
grant execute on function public.save_checkin(jsonb, uuid[]) to authenticated;
