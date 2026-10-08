-- Save an assignment's steps atomically under caller RLS with SECURITY INVOKER.
-- The AI total records the original estimate; blocked-step deletion remains guarded until replanning can clear a deleted step's blocks.

create policy steps_delete
on public.steps
for delete
to authenticated
using (user_id = (select auth.uid()));

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
    then
      raise exception 'invalid step minutes' using errcode = 'RS003';
    end if;

    if (v_step ->> 'estimated_minutes') !~ '^[0-9]+$' then
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
      select 1
      from public.session_steps as logged_steps
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
      select 1
      from public.blocks as scheduled_blocks
      where scheduled_blocks.step_id = existing_steps.id
    )
  order by existing_steps."order", existing_steps.id
  limit 1;

  if found then
    raise exception 'step is scheduled'
      using errcode = 'RS004', detail = v_removed_name;
  end if;

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
        user_id,
        assignment_id,
        name,
        "order",
        estimated_minutes,
        percent_done
      ) values (
        v_uid,
        p_assignment_id,
        v_name,
        v_position,
        v_estimated_minutes,
        0
      );
    end if;
  end loop;

  if p_ai_total is not null then
    if p_ai_total < 1 or p_ai_total > 12000 then
      raise exception 'invalid AI total' using errcode = 'RS003';
    end if;

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
