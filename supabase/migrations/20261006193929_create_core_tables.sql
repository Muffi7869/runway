create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  study_window_start time not null,
  study_window_end time not null,
  max_study_minutes_per_day integer not null,
  min_block_minutes integer not null,
  max_block_minutes integer not null,
  buffer_days integer not null,
  timezone text not null,
  check_in_time time not null default '23:30',
  canvas_feed_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_user_id_key unique (user_id),
  constraint settings_max_study_minutes_per_day_check
    check (max_study_minutes_per_day >= 0),
  constraint settings_min_block_minutes_check check (min_block_minutes >= 0),
  constraint settings_max_block_minutes_check check (max_block_minutes >= 0)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  name text not null,
  color text not null,
  pace_ratio numeric not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_pace_ratio_check check (pace_ratio > 0)
);

create table public.fixed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  title text not null,
  start timestamptz not null,
  "end" timestamptz not null,
  google_event_id text not null,
  source_calendar_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  class_id uuid not null references public.classes(id) on delete no action,
  title text not null,
  type text not null,
  deadline timestamptz not null,
  spec_text text not null,
  weight text not null,
  status text not null,
  ai_total_estimate_minutes integer not null,
  recurrence_rule text,
  canvas_uid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_type_check check (type in ('assignment', 'exam')),
  constraint assignments_weight_check check (weight in ('low', 'medium', 'high')),
  constraint assignments_status_check check (status in ('active', 'done', 'dropped')),
  constraint assignments_ai_total_estimate_minutes_check
    check (ai_total_estimate_minutes >= 0)
);

create unique index assignments_user_id_canvas_uid_key
  on public.assignments (user_id, canvas_uid)
  where canvas_uid is not null;

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  assignment_id uuid not null references public.assignments(id) on delete no action,
  name text not null,
  "order" integer not null,
  estimated_minutes integer not null,
  percent_done integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint steps_estimated_minutes_check check (estimated_minutes >= 0),
  constraint steps_percent_done_check check (percent_done in (0, 25, 50, 75, 100))
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  step_id uuid not null references public.steps(id) on delete no action,
  start timestamptz not null,
  "end" timestamptz not null,
  planned_minutes integer not null,
  google_event_id text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blocks_planned_minutes_check check (planned_minutes >= 0),
  constraint blocks_status_check check (status in ('planned', 'checked_in', 'missed'))
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  assignment_id uuid not null references public.assignments(id) on delete no action,
  step_id uuid not null references public.steps(id) on delete no action,
  date date not null,
  actual_minutes integer not null,
  percent_before integer not null,
  percent_after integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_actual_minutes_check check (actual_minutes >= 0)
);

create table public.blocked_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  date date not null,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger fixed_events_set_updated_at
before update on public.fixed_events
for each row execute function public.set_updated_at();

create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

create trigger steps_set_updated_at
before update on public.steps
for each row execute function public.set_updated_at();

create trigger blocks_set_updated_at
before update on public.blocks
for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create trigger blocked_days_set_updated_at
before update on public.blocked_days
for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
alter table public.classes enable row level security;
alter table public.fixed_events enable row level security;
alter table public.assignments enable row level security;
alter table public.steps enable row level security;
alter table public.blocks enable row level security;
alter table public.sessions enable row level security;
alter table public.blocked_days enable row level security;

create policy settings_select on public.settings
for select to authenticated
using (user_id = (select auth.uid()));

create policy settings_insert on public.settings
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy settings_update on public.settings
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy classes_select on public.classes
for select to authenticated
using (user_id = (select auth.uid()));

create policy classes_insert on public.classes
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy classes_update on public.classes
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy fixed_events_select on public.fixed_events
for select to authenticated
using (user_id = (select auth.uid()));

create policy fixed_events_insert on public.fixed_events
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy fixed_events_update on public.fixed_events
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy assignments_select on public.assignments
for select to authenticated
using (user_id = (select auth.uid()));

create policy assignments_insert on public.assignments
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy assignments_update on public.assignments
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy steps_select on public.steps
for select to authenticated
using (user_id = (select auth.uid()));

create policy steps_insert on public.steps
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy steps_update on public.steps
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy blocks_select on public.blocks
for select to authenticated
using (user_id = (select auth.uid()));

create policy blocks_insert on public.blocks
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy blocks_update on public.blocks
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy sessions_select on public.sessions
for select to authenticated
using (user_id = (select auth.uid()));

create policy sessions_insert on public.sessions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy sessions_update on public.sessions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy blocked_days_select on public.blocked_days
for select to authenticated
using (user_id = (select auth.uid()));

create policy blocked_days_insert on public.blocked_days
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy blocked_days_update on public.blocked_days
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
