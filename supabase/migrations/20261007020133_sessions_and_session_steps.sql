do $$
begin
  if exists (select 1 from public.sessions limit 1) then
    raise exception 'Cannot restructure sessions while rows exist.';
  end if;
end;
$$;

alter table public.sessions
  drop constraint if exists sessions_step_id_fkey,
  drop column step_id,
  drop column percent_before,
  drop column percent_after;

create table public.session_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  session_id uuid not null references public.sessions(id) on delete no action,
  step_id uuid not null references public.steps(id) on delete no action,
  percent_before integer not null,
  percent_after integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_steps_percent_before_check
    check (percent_before in (0, 25, 50, 75, 100)),
  constraint session_steps_percent_after_check
    check (percent_after in (0, 25, 50, 75, 100)),
  constraint session_steps_progress_order_check
    check (percent_after >= percent_before),
  constraint session_steps_session_id_step_id_key
    unique (session_id, step_id)
);

create trigger session_steps_set_updated_at
before update on public.session_steps
for each row execute function public.set_updated_at();

alter table public.session_steps enable row level security;

create policy session_steps_select
on public.session_steps
for select
to authenticated
using (user_id = (select auth.uid()));

create policy session_steps_insert
on public.session_steps
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy session_steps_update
on public.session_steps
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.settings
  add constraint settings_min_block_minimum_check
    check (min_block_minutes >= 15),
  add constraint settings_block_order_check
    check (max_block_minutes >= min_block_minutes),
  add constraint settings_day_limit_check
    check (max_study_minutes_per_day >= max_block_minutes),
  add constraint settings_window_fits_block_check
    check (
      extract(epoch from (study_window_end - study_window_start)) / 60
        >= min_block_minutes
    );
