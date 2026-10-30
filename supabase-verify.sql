-- KNOWN Daily — OPTIONAL verification after running supabase-setup.sql.
-- Run this in Supabase > SQL Editor. It does not modify data.

-- Expected: 6 daily_* tables, all showing rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'daily_%'
order by tablename;

-- Expected: one bucket, public = false, max size = 3145728.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'daily-photos';

-- Expected: 6 own-row table policies and 4 own-folder storage policies.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where (schemaname='public' and tablename like 'daily_%')
   or (schemaname='storage' and tablename='objects' and policyname like 'daily_storage_%')
order by schemaname, tablename, policyname;

-- NOTE: SQL Editor runs as an admin. The presence of RLS policies does not prove
-- complete end-to-end security; test with two separate authenticated accounts
-- before using this as a multi-user product.
