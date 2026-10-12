-- Phase 4 replaces only future planned blocks, preserves Google event ids on
-- matching rows, records planning metadata, and lets step edits remove future
-- planned work while protecting history and checked-in work.

create policy blocks_delete
on public.blocks
for delete
to authenticated
using (user_id = (select auth.uid()));

alter table public.settings
  add column last_plan_warnings jsonb,
  add column last_planned_at timestamptz;

create or replace function public.replace_planned_blocks(
  p_now timestamptz,
  p_blocks jsonb
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
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'authentication required';
  end if;

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

revoke execute on function public.replace_planned_blocks(timestamptz, jsonb)
from public;
revoke execute on function public.replace_planned_blocks(timestamptz, jsonb)
from anon;
grant execute on function public.replace_planned_blocks(timestamptz, jsonb)
to authenticated;

create or replace function public.save_assignment_steps(
  p_assignment_id uuid,
  p_steps jsonb,
  p_ai_total integer default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid;
  v_assignment_id uuid;
  v_step jsonb;
  v_step_id uuid;
  v_kept_ids uuid[] := '{}'::uuid[];
  v_position bigint;
  v_name text;
  v_estimated_numeric numeric;
  v_estimated_minutes integer;
  v_removed_name text;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'authentication required' using errcode = 'RS002';
  end if;

  select assignments.id
  into v_assignment_id
  from public.assignments as assignments
  where assignments.id = p_assignment_id
    and assignments.user_id = v_uid
    and assignments.status = 'active'
  for update;

  if not found then
    raise exception 'assignment not found' using errcode = 'RS002';
  end if;

  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    raise exception 'steps must be an array' using errcode = 'RS003';
  end if;

  if jsonb_array_length(p_steps) < 1 or jsonb_array_length(p_steps) > 20 then
    raise exception 'provide 1 to 20 steps' using errcode = 'RS003';
  end if;

  for v_step in
    select step_value
    from jsonb_array_elements(p_steps) as step_rows(step_value)
  loop
    if jsonb_typeof(v_step) <> 'object' then
      raise exception 'each step must be an object' using errcode = 'RS003';
    end if;

    if not (v_step ? 'name')
      or jsonb_typeof(v_step -> 'name') <> 'string'
      or char_length(btrim(v_step ->> 'name')) < 1
      or char_length(btrim(v_step ->> 'name')) > 60
    then
      raise exception 'invalid step name' using errcode = 'RS003';
    end if;

    if not (v_step ? 'estimated_minutes')
      or jsonb_typeof(v_step -> 'estimated_minutes') <> 'number'
      or (v_step ->> 'estimated_minutes') !~ '^[0-9]+$'
    then
      raise exception 'invalid step minutes' using errcode = 'RS003';
    end if;

    v_estimated_numeric := (v_step ->> 'estimated_minutes')::numeric;

    if v_estimated_numeric < 15
      or v_estimated_numeric > 600
      or mod(v_estimated_numeric, 5) <> 0
    then
      raise exception 'invalid step minutes' using errcode = 'RS003';
    end if;

    v_step_id := null;

    if v_step ? 'id' and v_step -> 'id' <> 'null'::jsonb then
      if jsonb_typeof(v_step -> 'id') <> 'string' then
        raise exception 'invalid step id' using errcode = 'RS003';
      end if;

      begin
        v_step_id := (v_step ->> 'id')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid step id' using errcode = 'RS003';
      end;

      if v_step_id = any(v_kept_ids) then
        raise exception 'duplicate step id' using errcode = 'RS003';
      end if;

      v_kept_ids := array_append(v_kept_ids, v_step_id);
    end if;
  end loop;

  if exists (
    select 1
    from unnest(v_kept_ids) as kept(step_id)
    where not exists (
      select 1
      from public.steps as owned_steps
      where owned_steps.id = kept.step_id
        and owned_steps.assignment_id = p_assignment_id
        and owned_steps.user_id = v_uid
    )
  ) then
    raise exception 'step does not belong to assignment' using errcode = 'RS003';
  end if;

  select existing_steps.name
  into v_removed_name
  from public.steps as existing_steps
  where existing_steps.assignment_id = p_assignment_id
    and existing_steps.user_id = v_uid
    and not (existing_steps.id = any(v_kept_ids))
    and exists (
      select 1 from public.session_steps as logged_steps
      where logged_steps.step_id = existing_steps.id
    )
  order by existing_steps."order", existing_steps.id
  limit 1;

  if found then
    raise exception 'step has logged work'
      using errcode = 'RS001', detail = v_removed_name;
  end if;

  select existing_steps.name
  into v_removed_name
  from public.steps as existing_steps
  where existing_steps.assignment_id = p_assignment_id
    and existing_steps.user_id = v_uid
    and not (existing_steps.id = any(v_kept_ids))
    and exists (
      select 1 from public.blocks as protected_blocks
      where protected_blocks.step_id = existing_steps.id
        and not (
          protected_blocks.status = 'planned'
          and protected_blocks.start >= now()
        )
    )
  order by existing_steps."order", existing_steps.id
  limit 1;

  if found then
    raise exception 'step is scheduled'
      using errcode = 'RS004', detail = v_removed_name;
  end if;

  if p_ai_total is not null and (p_ai_total < 1 or p_ai_total > 12000) then
    raise exception 'invalid AI total' using errcode = 'RS003';
  end if;

  delete from public.blocks as future_blocks
  using public.steps as removed_steps
  where removed_steps.assignment_id = p_assignment_id
    and removed_steps.user_id = v_uid
    and not (removed_steps.id = any(v_kept_ids))
    and future_blocks.step_id = removed_steps.id
    and future_blocks.user_id = v_uid
    and future_blocks.status = 'planned'
    and future_blocks.start >= now();

  delete from public.steps as removed_steps
  where removed_steps.assignment_id = p_assignment_id
    and removed_steps.user_id = v_uid
    and not (removed_steps.id = any(v_kept_ids));

  for v_step, v_position in
    select step_value, step_position
    from jsonb_array_elements(p_steps) with ordinality
      as step_rows(step_value, step_position)
    order by step_position
  loop
    v_name := btrim(v_step ->> 'name');
    v_estimated_minutes := (v_step ->> 'estimated_minutes')::integer;
    v_step_id := null;

    if v_step ? 'id' and v_step -> 'id' <> 'null'::jsonb then
      v_step_id := (v_step ->> 'id')::uuid;
    end if;

    if v_step_id is not null then
      update public.steps as updated_steps
      set name = v_name,
          estimated_minutes = v_estimated_minutes,
          "order" = v_position
      where updated_steps.id = v_step_id
        and updated_steps.assignment_id = p_assignment_id
        and updated_steps.user_id = v_uid;
    else
      insert into public.steps (
        user_id, assignment_id, name, "order", estimated_minutes, percent_done
      ) values (
        v_uid, p_assignment_id, v_name, v_position, v_estimated_minutes, 0
      );
    end if;
  end loop;

  if p_ai_total is not null then
    update public.assignments as saved_assignment
    set ai_total_estimate_minutes = p_ai_total
    where saved_assignment.id = p_assignment_id
      and saved_assignment.user_id = v_uid;
  end if;
end;
$$;

revoke execute on function public.save_assignment_steps(uuid, jsonb, integer)
from public;
revoke execute on function public.save_assignment_steps(uuid, jsonb, integer)
from anon;
grant execute on function public.save_assignment_steps(uuid, jsonb, integer)
to authenticated;
