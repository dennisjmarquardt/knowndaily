-- KNOWN Daily: formation practices migration (run ONLY after reviewing in Supabase SQL Editor).
-- Additive: does not modify existing daily_habits, writing, photos, or Bible progress.
-- Review the policy results after running and test two separate user accounts.

create table if not exists public.daily_prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person text not null check (char_length(person) between 1 and 160),
  request_text text not null check (char_length(request_text) between 1 and 8000),
  status text not null default 'active' check (status in ('active','answered','archived')),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists daily_prayer_requests_user_idx on public.daily_prayer_requests(user_id,status,created_at desc);

create table if not exists public.daily_prayer_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  content text not null check(char_length(content) between 1 and 8000),
  created_at timestamptz not null default now(),
  constraint daily_prayer_updates_owner_fk foreign key(request_id,user_id)
    references public.daily_prayer_requests(id,user_id) on delete cascade
);
create index if not exists daily_prayer_updates_request_idx on public.daily_prayer_updates(user_id,request_id,created_at);

create table if not exists public.daily_prayer_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  day date not null,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id,day),
  constraint daily_prayer_checkins_owner_fk foreign key(request_id,user_id)
    references public.daily_prayer_requests(id,user_id) on delete cascade
);

create table if not exists public.daily_prayer_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  minutes integer not null default 0 check(minutes between 0 and 1440),
  updated_at timestamptz not null default now(),
  primary key(user_id,day)
);

create table if not exists public.daily_gratitude (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  items text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key(user_id,week_start),
  constraint daily_gratitude_item_limit check (cardinality(items) <= 10)
);

create table if not exists public.daily_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  content text not null default '',
  photo_path text,
  updated_at timestamptz not null default now(),
  primary key(user_id,day)
);

alter table public.daily_prayer_requests enable row level security;
alter table public.daily_prayer_updates enable row level security;
alter table public.daily_prayer_checkins enable row level security;
alter table public.daily_prayer_sessions enable row level security;
alter table public.daily_gratitude enable row level security;
alter table public.daily_notes enable row level security;

drop policy if exists "daily_prayer_requests_own" on public.daily_prayer_requests;
create policy "daily_prayer_requests_own" on public.daily_prayer_requests
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "daily_prayer_updates_own" on public.daily_prayer_updates;
create policy "daily_prayer_updates_own" on public.daily_prayer_updates
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "daily_prayer_checkins_own" on public.daily_prayer_checkins;
create policy "daily_prayer_checkins_own" on public.daily_prayer_checkins
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "daily_prayer_sessions_own" on public.daily_prayer_sessions;
create policy "daily_prayer_sessions_own" on public.daily_prayer_sessions
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "daily_gratitude_own" on public.daily_gratitude;
create policy "daily_gratitude_own" on public.daily_gratitude
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "daily_notes_own" on public.daily_notes;
create policy "daily_notes_own" on public.daily_notes
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.daily_prayer_requests,
  public.daily_prayer_updates,public.daily_prayer_checkins,
  public.daily_prayer_sessions,public.daily_gratitude,public.daily_notes to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('daily-note-photos','daily-note-photos',false,3145728,array['image/webp'])
on conflict(id) do update
set public=false,file_size_limit=3145728,allowed_mime_types=array['image/webp'];

drop policy if exists "daily_notes_photos_read" on storage.objects;
create policy "daily_notes_photos_read" on storage.objects for select to authenticated
using(bucket_id='daily-note-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "daily_notes_photos_insert" on storage.objects;
create policy "daily_notes_photos_insert" on storage.objects for insert to authenticated
with check(bucket_id='daily-note-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "daily_notes_photos_update" on storage.objects;
create policy "daily_notes_photos_update" on storage.objects for update to authenticated
using(bucket_id='daily-note-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='daily-note-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "daily_notes_photos_delete" on storage.objects;
create policy "daily_notes_photos_delete" on storage.objects for delete to authenticated
using(bucket_id='daily-note-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Manual verification:
-- select tablename,rowsecurity from pg_tables where schemaname='public' and tablename in
-- ('daily_prayer_requests','daily_prayer_updates','daily_prayer_checkins',
--  'daily_prayer_sessions','daily_gratitude','daily_notes');
-- select id,public from storage.buckets where id='daily-note-photos';
