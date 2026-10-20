-- V2-1 adds separate weekday/weekend planning inputs, named capacity levels,
-- per-day capacity overrides, and durable exam decisions. The legacy daily
-- maximum stays temporarily because the deployed app still reads and writes
-- it; its blocking constraints are retired and a later migration will drop it.
-- Existing selected calendars remain Busy in fixed_calendar_ids. The new
-- visible and exam arrays start empty, so current sync and display behavior is
-- unchanged. events_calendar_id is reserved for V2-2 and is unused in V2-1.

alter table public.settings
  add column weekend_window_start time,
  add column weekend_window_end time,
  add column capacity_light_minutes integer,
  add column capacity_normal_minutes integer,
  add column capacity_heavy_minutes integer;

-- Preserve the old daily maximum as Normal. Clamp it to the new valid range;
-- when it falls below Light or above Heavy, adjust only that boundary enough
-- to preserve light <= normal <= heavy.
update public.settings
set capacity_normal_minutes = greatest(0, least(max_study_minutes_per_day, 1440)),
    capacity_light_minutes = least(
      120,
      greatest(0, least(max_study_minutes_per_day, 1440))
    ),
    capacity_heavy_minutes = greatest(
      420,
      greatest(0, least(max_study_minutes_per_day, 1440))
    );

alter table public.settings
  alter column capacity_light_minutes set default 120,
  alter column capacity_light_minutes set not null,
  alter column capacity_normal_minutes set default 240,
  alter column capacity_normal_minutes set not null,
  alter column capacity_heavy_minutes set default 420,
  alter column capacity_heavy_minutes set not null,
  drop constraint settings_max_study_minutes_per_day_check,
  drop constraint settings_day_limit_check,
  alter column max_study_minutes_per_day drop not null,
  alter column max_study_minutes_per_day drop default,
  add constraint settings_weekend_window_pair_check
    check (
      (weekend_window_start is null and weekend_window_end is null)
      or (
        weekend_window_start is not null
        and weekend_window_end is not null
        and weekend_window_end > weekend_window_start
      )
    ),
  add constraint settings_capacity_order_check
    check (
      capacity_light_minutes >= 0
      and capacity_light_minutes <= capacity_normal_minutes
      and capacity_normal_minutes <= capacity_heavy_minutes
      and capacity_heavy_minutes <= 1440
    );

comment on column public.settings.max_study_minutes_per_day is
  'Deprecated and unused by V2 planning; retained temporarily for the pre-V2 deployed app and dropped by a later migration.';

create table public.day_capacity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  date date not null,
  level text not null,
  custom_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint day_capacity_user_id_date_key unique (user_id, date),
  constraint day_capacity_level_check
    check (level in ('off', 'light', 'normal', 'heavy', 'custom')),
  constraint day_capacity_custom_minutes_check
    check (
      (level = 'custom' and custom_minutes between 0 and 1440)
      or (level <> 'custom' and custom_minutes is null)
    )
);

create trigger day_capacity_set_updated_at
before update on public.day_capacity
for each row execute function public.set_updated_at();

alter table public.day_capacity enable row level security;

create policy day_capacity_select on public.day_capacity
for select to authenticated
using (user_id = (select auth.uid()));

create policy day_capacity_insert on public.day_capacity
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy day_capacity_update on public.day_capacity
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy day_capacity_delete on public.day_capacity
for delete to authenticated
using (user_id = (select auth.uid()));

create table public.exam_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  source_calendar_id text not null,
  google_event_id text not null,
  decision text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_decisions_user_calendar_event_key
    unique (user_id, source_calendar_id, google_event_id),
  constraint exam_decisions_decision_check
    check (decision in ('protect', 'not_exam', 'no_protection'))
);

create trigger exam_decisions_set_updated_at
before update on public.exam_decisions
for each row execute function public.set_updated_at();

alter table public.exam_decisions enable row level security;

create policy exam_decisions_select on public.exam_decisions
for select to authenticated
using (user_id = (select auth.uid()));

create policy exam_decisions_insert on public.exam_decisions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy exam_decisions_update on public.exam_decisions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy exam_decisions_delete on public.exam_decisions
for delete to authenticated
using (user_id = (select auth.uid()));

alter table public.google_connection
  add column exam_calendar_ids text[] not null default '{}',
  add column visible_calendar_ids text[] not null default '{}',
  add column events_calendar_id text;
