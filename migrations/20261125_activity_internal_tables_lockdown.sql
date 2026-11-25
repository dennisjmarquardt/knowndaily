-- Explicitly deny browser-role access to server-only provider credentials and OAuth state.
-- The Edge Function connects with the server-side database role.
drop policy if exists daily_activity_credentials_no_client_access on public.daily_activity_credentials;
create policy daily_activity_credentials_no_client_access on public.daily_activity_credentials
  for all to anon, authenticated using (false) with check (false);

drop policy if exists daily_activity_oauth_states_no_client_access on public.daily_activity_oauth_states;
create policy daily_activity_oauth_states_no_client_access on public.daily_activity_oauth_states
  for all to anon, authenticated using (false) with check (false);
