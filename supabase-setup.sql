-- KNOWN Daily v0.1 — Run ONCE in Supabase SQL Editor, in a NEW project.
-- All personal tables are protected by row-level security (RLS).
-- Never put Supabase's service_role or secret key into a public website.

create table if not exists public.daily_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reading_index integer not null default 0 check (reading_index >= 0),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.daily_habits (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null check(kind in ('check','time','bed','reading','writing','activity')),
  goal integer not null default 1 check (goal >= 1 and goal <= 10000),
  target_time text,
  position integer not null default 0,
  constraint daily_habits_id_user_unique unique (id, user_id)
);
create index if not exists daily_habits_user_idx on public.daily_habits(user_id);
create table if not exists public.daily_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  day date not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id,habit_id,day),
  -- A completion can only refer to a habit owned by the same user.
  constraint daily_completions_habit_owner_fk foreign key (habit_id,user_id)
    references public.daily_habits(id,user_id) on delete cascade
);
create table if not exists public.daily_writing (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  content text not null default '',
  word_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id,day)
);
create table if not exists public.daily_readings (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  chapters text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id,day)
);
create table if not exists public.daily_photos (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  path text not null,
  primary key (user_id,day)
);

alter table public.daily_profiles enable row level security;
alter table public.daily_habits enable row level security;
alter table public.daily_completions enable row level security;
alter table public.daily_writing enable row level security;
alter table public.daily_readings enable row level security;
alter table public.daily_photos enable row level security;

-- Each user only ever reads or modifies rows they own.
drop policy if exists "daily_profiles_own" on public.daily_profiles;
create policy "daily_profiles_own" on public.daily_profiles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "daily_habits_own" on public.daily_habits;
create policy "daily_habits_own" on public.daily_habits for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "daily_completions_own" on public.daily_completions;
create policy "daily_completions_own" on public.daily_completions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "daily_writing_own" on public.daily_writing;
create policy "daily_writing_own" on public.daily_writing for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "daily_readings_own" on public.daily_readings;
create policy "daily_readings_own" on public.daily_readings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "daily_photos_own" on public.daily_photos;
create policy "daily_photos_own" on public.daily_photos for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The authenticated role needs Data API permissions as well as RLS policies.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.daily_profiles,public.daily_habits,public.daily_completions,public.daily_writing,public.daily_readings,public.daily_photos to authenticated;

-- One private storage bucket for compressed images, with per-user folder isolation.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('daily-photos','daily-photos',false,3145728,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/webp'];

drop policy if exists "daily_storage_read_own" on storage.objects;
create policy "daily_storage_read_own" on storage.objects for select to authenticated
  using (bucket_id='daily-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "daily_storage_insert_own" on storage.objects;
create policy "daily_storage_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id='daily-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "daily_storage_update_own" on storage.objects;
create policy "daily_storage_update_own" on storage.objects for update to authenticated
  using (bucket_id='daily-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id='daily-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "daily_storage_delete_own" on storage.objects;
create policy "daily_storage_delete_own" on storage.objects for delete to authenticated
  using (bucket_id='daily-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- End: confirm tables show RLS enabled and storage bucket is PRIVATE.
