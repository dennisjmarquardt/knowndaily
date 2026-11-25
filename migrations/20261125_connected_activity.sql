-- KNOWN Daily: private Apple Health and Strava activity integration.
-- All reads/writes for these tables go through the authenticated Edge Function.
create table if not exists public.daily_activity_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava','apple_health')),
  status text not null default 'connected' check (status in ('connected','disconnected')),
  scopes text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.daily_activity_summaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  source text not null check (source in ('strava','apple_health')),
  steps integer,
  exercise_minutes numeric(8,1),
  sleep_minutes numeric(8,1),
  workout_count integer,
  workout_minutes numeric(8,1),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, source),
  constraint daily_activity_steps_range check (steps is null or steps between 0 and 200000),
  constraint daily_activity_exercise_range check (exercise_minutes is null or exercise_minutes between 0 and 1440),
  constraint daily_activity_sleep_range check (sleep_minutes is null or sleep_minutes between 0 and 1440),
  constraint daily_activity_workout_count_range check (workout_count is null or workout_count between 0 and 100),
  constraint daily_activity_workout_minutes_range check (workout_minutes is null or workout_minutes between 0 and 1440)
);

create table if not exists public.daily_activity_workouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava','apple_health')),
  external_id text not null,
  day date not null,
  started_at timestamptz,
  name text not null default 'Workout',
  sport_type text not null default 'Workout',
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  distance_meters numeric(12,2) check (distance_meters is null or distance_meters between 0 and 1000000),
  elevation_gain_meters numeric(10,2) check (elevation_gain_meters is null or elevation_gain_meters between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, external_id)
);

-- OAuth tokens and one-time Shortcut credentials are never available to browser roles.
create table if not exists public.daily_activity_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava','apple_health')),
  encrypted_payload text,
  token_hash text,
  athlete_id bigint,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.daily_activity_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists daily_activity_summaries_user_day_idx
  on public.daily_activity_summaries(user_id, day desc);
create index if not exists daily_activity_workouts_user_day_idx
  on public.daily_activity_workouts(user_id, day desc);
create index if not exists daily_activity_credentials_athlete_idx
  on public.daily_activity_credentials(provider, athlete_id);

alter table public.daily_activity_connections enable row level security;
alter table public.daily_activity_summaries enable row level security;
alter table public.daily_activity_workouts enable row level security;
alter table public.daily_activity_credentials enable row level security;
alter table public.daily_activity_oauth_states enable row level security;

drop policy if exists daily_activity_connections_read_own on public.daily_activity_connections;
create policy daily_activity_connections_read_own on public.daily_activity_connections
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists daily_activity_summaries_read_own on public.daily_activity_summaries;
create policy daily_activity_summaries_read_own on public.daily_activity_summaries
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists daily_activity_workouts_read_own on public.daily_activity_workouts;
create policy daily_activity_workouts_read_own on public.daily_activity_workouts
  for select to authenticated using ((select auth.uid()) = user_id);

-- Browser clients cannot read or write these tables directly. The Edge Function
-- uses the server-side Postgres connection after validating the user's JWT/token.
revoke all on table public.daily_activity_connections from anon, authenticated;
revoke all on table public.daily_activity_summaries from anon, authenticated;
revoke all on table public.daily_activity_workouts from anon, authenticated;
revoke all on table public.daily_activity_credentials from anon, authenticated;
revoke all on table public.daily_activity_oauth_states from anon, authenticated;
grant all on table public.daily_activity_connections to service_role;
grant all on table public.daily_activity_summaries to service_role;
grant all on table public.daily_activity_workouts to service_role;
grant all on table public.daily_activity_credentials to service_role;
grant all on table public.daily_activity_oauth_states to service_role;

comment on table public.daily_activity_connections is 'Provider connection status; read and write only through KNOWN Daily Edge Function.';
comment on table public.daily_activity_summaries is 'Daily activity aggregates imported from Apple Health or Strava; not medical records.';
comment on table public.daily_activity_workouts is 'Workout summaries imported from Strava; no GPS streams or route coordinates are stored.';
comment on table public.daily_activity_credentials is 'Restricted provider credentials; never expose through the Data API.';
comment on table public.daily_activity_oauth_states is 'Short-lived, hashed Strava OAuth state values.';
