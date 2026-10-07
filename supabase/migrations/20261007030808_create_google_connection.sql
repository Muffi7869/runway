create table public.google_connection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete no action,
  refresh_token_encrypted text not null,
  granted_scopes text not null,
  fixed_calendar_ids text[] not null default '{}',
  runway_calendar_id text,
  last_synced_at timestamptz,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_connection_user_id_key unique (user_id),
  constraint google_connection_status_check
    check (status in ('connected', 'needs_reconnect'))
);

create trigger google_connection_set_updated_at
before update on public.google_connection
for each row execute function public.set_updated_at();

alter table public.google_connection enable row level security;

create policy google_connection_select
on public.google_connection
for select
to authenticated
using (user_id = (select auth.uid()));

create policy google_connection_insert
on public.google_connection
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy google_connection_update
on public.google_connection
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
