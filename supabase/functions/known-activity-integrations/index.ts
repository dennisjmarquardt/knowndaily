import postgres from "npm:postgres@3.4.7";
import { aggregateWorkouts, normalizeHealthPayload, normalizeStravaActivity } from "./activity-core.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const APP_URL = (Deno.env.get("KNOWN_DAILY_APP_URL") || "https://known-daily.vercel.app").replace(/\/$/, "");
const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") || "";
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") || "";
const STRAVA_VERIFY_TOKEN = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN") || "";
const PUBLISHABLE_KEYS = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"); } catch { return {}; }
})();
const API_KEY = PUBLISHABLE_KEYS.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
const db = DB_URL ? postgres(DB_URL, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 }) : null;
let encryptionKeyPromise;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
});
const fail = (message, status = 400) => json({ error: message }, status);
const nowISO = () => new Date().toISOString();
const appRedirect = (status) => Response.redirect(`${APP_URL}/?activity_${status}=1`, 302);

function requireDb() {
  if (!db) throw Object.assign(new Error("The Supabase database connection is not configured for this function."), { status: 503 });
  return db;
}
function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const value of data) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
}
function base64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function encryptionKey() {
  if (!encryptionKeyPromise) {
    // Derive a project-specific AES key from the server-only database URL.
    // The URL is injected by Supabase and is never returned to the client.
    const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(DB_URL + ":known-daily-activity-token-v1"));
    encryptionKeyPromise = crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  return encryptionKeyPromise;
}
async function encrypt(value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(JSON.stringify(value)));
  return base64Url(new Uint8Array([...iv, ...new Uint8Array(ciphertext)]));
}
async function decrypt(value) {
  const bytes = fromBase64Url(value);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await encryptionKey(), bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function requireUser(req) {
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) throw Object.assign(new Error("Sign in to KNOWN Daily first."), { status: 401 });
  if (!SUPABASE_URL || !API_KEY) throw Object.assign(new Error("Supabase Auth is not configured for this function."), { status: 503 });
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: API_KEY, authorization },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw Object.assign(new Error("Your KNOWN Daily session has expired. Please sign in again."), { status: 401 });
  const user = await response.json();
  if (!user?.id) throw Object.assign(new Error("No authenticated KNOWN Daily account was found."), { status: 401 });
  return user.id;
}
async function stravaRequest(path, accessToken, options = {}) {
  const response = await fetch(`https://www.strava.com/api/v3${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(12000)
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) {
    const message = response.status === 401 ? "Strava authorization expired. Reconnect Strava in Customize." :
      response.status === 429 ? "Strava rate limit reached. Please wait before syncing again." :
      `Strava returned HTTP ${response.status}.`;
    throw Object.assign(new Error(message), { status: response.status === 429 ? 429 : 502 });
  }
  return data;
}
async function ensureWebhook() {
  if (!STRAVA_VERIFY_TOKEN) return false;
  const callback = `${SUPABASE_URL}/functions/v1/known-activity-integrations?mode=strava-webhook`;
  const query = new URLSearchParams({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET });
  const existing = await fetch(`https://www.strava.com/api/v3/push_subscriptions?${query}`, { signal: AbortSignal.timeout(8000) });
  if (existing.ok) {
    const subscriptions = await existing.json();
    if (Array.isArray(subscriptions) && subscriptions.some(item => item.callback_url === callback)) return true;
  }
  const form = new FormData();
  form.set("client_id", STRAVA_CLIENT_ID);
  form.set("client_secret", STRAVA_CLIENT_SECRET);
  form.set("callback_url", callback);
  form.set("verify_token", STRAVA_VERIFY_TOKEN);
  const response = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
    method: "POST", body: form, signal: AbortSignal.timeout(10000)
  });
  if (response.ok) return true;
  if (response.status === 409) return true;
  console.warn("Strava webhook subscription could not be confirmed:", response.status);
  return false;
}
async function handleStravaStart(userId) {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) throw Object.assign(new Error("Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Supabase Edge Function Secrets before connecting Strava."), { status: 503 });
  const sql = requireDb();
  const state = randomToken();
  const stateHash = await sha256(state);
  await sql`delete from public.daily_activity_oauth_states where expires_at < now()`;
  await sql`insert into public.daily_activity_oauth_states (state_hash, user_id, expires_at) values (${stateHash}, ${userId}::uuid, now() + interval '10 minutes')`;
  const callback = `${SUPABASE_URL}/functions/v1/known-activity-integrations?mode=strava-callback`;
  const webhookReady = await ensureWebhook().catch(() => false);
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: callback,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
    state
  });
  return json({ authorization_url: `https://www.strava.com/oauth/authorize?${params.toString()}`, webhook_ready: webhookReady });
}
async function handleStravaCallback(url) {
  const error = url.searchParams.get("error");
  if (error) return appRedirect(error === "access_denied" ? "cancelled" : "error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) return appRedirect("error");
  const sql = requireDb();
  const stateHash = await sha256(state);
  const matches = await sql`select user_id from public.daily_activity_oauth_states where state_hash = ${stateHash} and expires_at > now() limit 1`;
  if (!matches.length) return appRedirect("invalid_state");
  const userId = matches[0].user_id;
  await sql`delete from public.daily_activity_oauth_states where state_hash = ${stateHash}`;
  const form = new FormData();
  form.set("client_id", STRAVA_CLIENT_ID);
  form.set("client_secret", STRAVA_CLIENT_SECRET);
  form.set("code", code);
  form.set("grant_type", "authorization_code");
  const response = await fetch("https://www.strava.com/api/v3/oauth/token", { method: "POST", body: form, signal: AbortSignal.timeout(12000) });
  if (!response.ok) return appRedirect("error");
  const tokens = await response.json();
  const granted = String(url.searchParams.get("scope") || tokens.scope || "").split(/[ ,]+/).filter(Boolean);
  if (!granted.some(scope => scope === "activity:read_all" || scope === "activity:read")) return appRedirect("scope_error");
  const athleteId = tokens.athlete?.id;
  if (!athleteId || !tokens.access_token || !tokens.refresh_token) return appRedirect("error");
  const encrypted = await encrypt({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at
  });
  await sql`insert into public.daily_activity_credentials (user_id, provider, encrypted_payload, athlete_id, scopes, updated_at)
    values (${userId}::uuid, 'strava', ${encrypted}, ${athleteId}, ${granted.join(" ")}, now())
    on conflict (user_id, provider) do update set encrypted_payload = excluded.encrypted_payload,
      athlete_id = excluded.athlete_id, scopes = excluded.scopes, updated_at = now()`;
  await sql`insert into public.daily_activity_connections (user_id, provider, status, scopes, connected_at, last_sync_at, updated_at)
    values (${userId}::uuid, 'strava', 'connected', ${granted.join(" ")}, now(), null, now())
    on conflict (user_id, provider) do update set status = 'connected', scopes = excluded.scopes,
      connected_at = now(), last_sync_at = null, updated_at = now()`;
  return appRedirect("connected");
}
async function refreshedStravaCredential(userId) {
  const sql = requireDb();
  const rows = await sql`select encrypted_payload, athlete_id from public.daily_activity_credentials where user_id = ${userId}::uuid and provider = 'strava' limit 1`;
  if (!rows.length || !rows[0].encrypted_payload) throw Object.assign(new Error("Connect your Strava account first."), { status: 409 });
  const credential = await decrypt(rows[0].encrypted_payload);
  if (Number(credential.expires_at || 0) <= Math.floor(Date.now() / 1000) + 300) {
    const form = new FormData();
    form.set("client_id", STRAVA_CLIENT_ID);
    form.set("client_secret", STRAVA_CLIENT_SECRET);
    form.set("grant_type", "refresh_token");
    form.set("refresh_token", credential.refresh_token);
    const response = await fetch("https://www.strava.com/api/v3/oauth/token", { method: "POST", body: form, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw Object.assign(new Error("Strava could not refresh its authorization. Reconnect Strava in Customize."), { status: 401 });
    const fresh = await response.json();
    credential.access_token = fresh.access_token;
    credential.refresh_token = fresh.refresh_token;
    credential.expires_at = fresh.expires_at;
    const encrypted = await encrypt(credential);
    await sql`update public.daily_activity_credentials set encrypted_payload = ${encrypted}, updated_at = now()
      where user_id = ${userId}::uuid and provider = 'strava'`;
  }
  return { ...credential, athlete_id: rows[0].athlete_id };
}
async function handleStravaSync(userId) {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) throw Object.assign(new Error("Strava server credentials are not configured."), { status: 503 });
  const sql = requireDb();
  const credential = await refreshedStravaCredential(userId);
  const connections = await sql`select last_sync_at from public.daily_activity_connections where user_id = ${userId}::uuid and provider = 'strava' limit 1`;
  const lastSync = connections[0]?.last_sync_at;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const afterDate = lastSync ? new Date(new Date(lastSync).getTime() - 2 * 86400000) : ninetyDaysAgo;
  const after = Math.floor(afterDate.getTime() / 1000);
  let page = 1, received = 0, more = false;
  const touchedDays = new Set();
  while (page <= 20) {
    const activities = await stravaRequest(`/athlete/activities?after=${after}&per_page=100&page=${page}`, credential.access_token);
    if (!Array.isArray(activities)) throw Object.assign(new Error("Strava returned an unexpected activity response."), { status: 502 });
    for (const raw of activities) {
      const activity = normalizeStravaActivity(raw);
      if (!activity) continue;
      await sql`insert into public.daily_activity_workouts
        (user_id, provider, external_id, day, started_at, name, sport_type, duration_seconds, distance_meters, elevation_gain_meters, updated_at)
        values (${userId}::uuid, 'strava', ${activity.external_id}, ${activity.day}::date, ${activity.started_at}::timestamptz,
          ${activity.name}, ${activity.sport_type}, ${activity.duration_seconds}, ${activity.distance_meters}, ${activity.elevation_gain_meters}, now())
        on conflict (user_id, provider, external_id) do update set day = excluded.day, started_at = excluded.started_at,
          name = excluded.name, sport_type = excluded.sport_type, duration_seconds = excluded.duration_seconds,
          distance_meters = excluded.distance_meters, elevation_gain_meters = excluded.elevation_gain_meters, updated_at = now()`;
      touchedDays.add(activity.day);
      received += 1;
    }
    if (activities.length < 100) break;
    if (page === 20) more = true;
    page += 1;
  }
  const startDay = ninetyDaysAgo.toISOString().slice(0, 10);
  await sql`delete from public.daily_activity_summaries where user_id = ${userId}::uuid and source = 'strava' and day >= ${startDay}::date`;
  const workoutRows = await sql`select day::text as day, duration_seconds from public.daily_activity_workouts
    where user_id = ${userId}::uuid and provider = 'strava' and day >= ${startDay}::date order by day`;
  for (const total of aggregateWorkouts(workoutRows)) {
    await sql`insert into public.daily_activity_summaries
      (user_id, day, source, workout_count, workout_minutes, updated_at)
      values (${userId}::uuid, ${total.day}::date, 'strava', ${total.workout_count}, ${total.workout_minutes}, now())`;
  }
  await sql`update public.daily_activity_connections set status = 'connected', last_sync_at = now(), updated_at = now()
    where user_id = ${userId}::uuid and provider = 'strava'`;
  return json({ synced: received, days_with_workouts: touchedDays.size, last_sync_at: nowISO(), more_available: more });
}
async function handleAppleHealthToken(userId) {
  const sql = requireDb();
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  await sql`insert into public.daily_activity_credentials (user_id, provider, token_hash, updated_at)
    values (${userId}::uuid, 'apple_health', ${tokenHash}, now())
    on conflict (user_id, provider) do update set token_hash = excluded.token_hash, updated_at = now()`;
  await sql`insert into public.daily_activity_connections (user_id, provider, status, connected_at, last_sync_at, updated_at)
    values (${userId}::uuid, 'apple_health', 'connected', now(), null, now())
    on conflict (user_id, provider) do update set status = 'connected', connected_at = now(), updated_at = now()`;
  return json({ token, message: "Copy this key into your Apple Shortcut now. It is shown only once." });
}
async function handleAppleHealthIngest(req) {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/i);
  if (!match) return fail("A valid KNOWN Daily Shortcut key is required.", 401);
  const sql = requireDb();
  const tokenHash = await sha256(match[1]);
  const credentials = await sql`select user_id from public.daily_activity_credentials
    where provider = 'apple_health' and token_hash = ${tokenHash} limit 1`;
  if (!credentials.length) return fail("This Apple Health Shortcut key has been revoked. Generate a new one in Customize.", 401);
  let body;
  try { body = await req.json(); } catch { return fail("The Shortcut request must contain JSON."); }
  let metrics;
  try { metrics = normalizeHealthPayload(body); } catch (error) { return fail(error.message); }
  const userId = credentials[0].user_id;
  await sql`insert into public.daily_activity_summaries
    (user_id, day, source, steps, exercise_minutes, sleep_minutes, updated_at)
    values (${userId}::uuid, ${metrics.day}::date, 'apple_health', ${metrics.steps}, ${metrics.exercise_minutes}, ${metrics.sleep_minutes}, now())
    on conflict (user_id, day, source) do update set steps = excluded.steps, exercise_minutes = excluded.exercise_minutes,
      sleep_minutes = excluded.sleep_minutes, updated_at = now()`;
  await sql`update public.daily_activity_connections set status = 'connected', last_sync_at = now(), updated_at = now()
    where user_id = ${userId}::uuid and provider = 'apple_health'`;
  return json({ ok: true, day: metrics.day, received: ["steps", "exercise_minutes", "sleep_minutes"].filter(key => metrics[key] !== null) });
}
async function handleStravaDisconnect(userId) {
  const sql = requireDb();
  try {
    const credential = await refreshedStravaCredential(userId);
    await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: credential.access_token }),
      signal: AbortSignal.timeout(7000)
    });
  } catch { /* A local disconnect must still revoke our stored credential. */ }
  await sql`delete from public.daily_activity_credentials where user_id = ${userId}::uuid and provider = 'strava'`;
  await sql`update public.daily_activity_connections set status = 'disconnected', updated_at = now()
    where user_id = ${userId}::uuid and provider = 'strava'`;
  return json({ ok: true, retained_history: true });
}
async function handleAppleHealthDisconnect(userId) {
  const sql = requireDb();
  await sql`delete from public.daily_activity_credentials where user_id = ${userId}::uuid and provider = 'apple_health'`;
  await sql`update public.daily_activity_connections set status = 'disconnected', updated_at = now()
    where user_id = ${userId}::uuid and provider = 'apple_health'`;
  return json({ ok: true, retained_history: true });
}
async function handleWebhook(req, url) {
  const challenge = url.searchParams.get("hub.challenge");
  if (req.method === "GET" && challenge) {
    if (!STRAVA_VERIFY_TOKEN || url.searchParams.get("hub.mode") !== "subscribe" ||
        url.searchParams.get("hub.verify_token") !== STRAVA_VERIFY_TOKEN) return fail("Webhook verification failed.", 403);
    return json({ "hub.challenge": challenge });
  }
  if (req.method !== "POST") return fail("Unsupported webhook method.", 405);
  let event;
  try { event = await req.json(); } catch { return fail("Invalid webhook event."); }
  if (!event?.owner_id || !event?.object_type || !event?.aspect_type) return json({ ok: true });
  const sql = requireDb();
  const rows = await sql`select user_id from public.daily_activity_credentials
    where provider = 'strava' and athlete_id = ${event.owner_id} limit 1`;
  if (!rows.length) return json({ ok: true });
  const userId = rows[0].user_id;
  if (event.object_type === "athlete" && event.updates?.authorized === "false") {
    await sql`delete from public.daily_activity_credentials where user_id = ${userId}::uuid and provider = 'strava'`;
    await sql`update public.daily_activity_connections set status = 'disconnected', updated_at = now()
      where user_id = ${userId}::uuid and provider = 'strava'`;
  } else {
    if (event.object_type === "activity" && event.aspect_type === "delete") {
      await sql`delete from public.daily_activity_workouts where user_id = ${userId}::uuid and provider = 'strava' and external_id = ${String(event.object_id)}`;
    }
    await sql`update public.daily_activity_connections set last_sync_at = null, updated_at = now()
      where user_id = ${userId}::uuid and provider = 'strava'`;
  }
  return json({ ok: true });
}
async function handleStatus(userId) {
  const sql = requireDb();
  const rows = await sql`select provider, status, connected_at, last_sync_at, scopes
    from public.daily_activity_connections where user_id = ${userId}::uuid order by provider`;
  return json({ connections: rows });
}
async function handleSummary(userId, day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail("A valid day is required.");
  const sql = requireDb();
  const [summaries, workouts] = await Promise.all([
    sql`select source, steps, exercise_minutes, sleep_minutes, workout_count, workout_minutes, updated_at
      from public.daily_activity_summaries where user_id = ${userId}::uuid and day = ${day}::date`,
    sql`select external_id, provider, started_at, name, sport_type, duration_seconds, distance_meters, elevation_gain_meters
      from public.daily_activity_workouts where user_id = ${userId}::uuid and day = ${day}::date
      order by started_at desc nulls last limit 20`
  ]);
  return json({ day, summaries, workouts });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || url.searchParams.get("action") || "";
  try {
    if (req.method === "GET" && url.searchParams.has("hub.challenge")) return await handleWebhook(req, url);
    if (mode === "strava-webhook") return await handleWebhook(req, url);
    if (mode === "strava-callback" && req.method === "GET") return await handleStravaCallback(url);
    if (mode === "apple-health-ingest" && req.method === "POST") return await handleAppleHealthIngest(req);
    const userId = await requireUser(req);
    if (mode === "status") return await handleStatus(userId);
    if (mode === "summary") return await handleSummary(userId, url.searchParams.get("day") || "");
    if (mode === "strava-start" && req.method === "GET") return await handleStravaStart(userId);
    if (mode === "strava-sync" && req.method === "POST") return await handleStravaSync(userId);
    if (mode === "strava-disconnect" && req.method === "POST") return await handleStravaDisconnect(userId);
    if (mode === "apple-health-token" && req.method === "POST") return await handleAppleHealthToken(userId);
    if (mode === "apple-health-disconnect" && req.method === "POST") return await handleAppleHealthDisconnect(userId);
    return fail("Unsupported activity integration action.", 404);
  } catch (error) {
    console.error("KNOWN Daily activity integration error:", error?.message || "Unknown error");
    return fail(error?.message || "The activity integration could not complete this request.", error?.status || 500);
  }
});
