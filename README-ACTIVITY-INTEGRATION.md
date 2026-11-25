# KNOWN Daily — Connected activity

This feature adds a compact **Movement & recovery** readout to the Today dashboard.

## Dashboard behavior

- **Active minutes:** Apple Health Exercise Minutes is the preferred daily total. If Apple Health has not supplied exercise minutes, KNOWN Daily falls back to Strava workout duration, then to the user's manual activity log.
- **Workout detail:** Strava contributes workout name, sport, duration, distance, and elevation. The dashboard lists up to three workouts for the selected day.
- **Steps and sleep:** daily totals are supplied by Apple Health.
- **No double-counting:** when Apple Health exercise minutes are available, Strava duration is shown as workout detail and is not added to the exercise-minute total.
- **Habit completion:** imported activity updates the activity readout and progress against the configured goal, but it does not silently mark the habit complete. The user taps the existing checkmark when ready.
- **Privacy:** KNOWN Daily stores daily totals and workout summaries, not GPS route streams, full Health exports, or heart-rate histories. Disconnecting stops future imports; imported history is retained.

## Supabase migration

Apply [migrations/20261125_connected_activity.sql](migrations/20261125_connected_activity.sql) to the KNOWN Daily Supabase project. It creates five tables with RLS enabled. Browser roles have no table grants; the Edge Function accesses them through the server-side database connection.

## Deploy the Edge Function

Deploy `supabase/functions/known-activity-integrations/index.ts` with its companion `activity-core.mjs` as function `known-activity-integrations`. Set JWT verification **off** for the gateway because this single function has three entry types: signed-in app requests (the function validates the Supabase access token itself), Strava's OAuth/webhook callbacks, and Apple Shortcut requests (validated by a one-time bearer key). Do not remove the function's internal validation.

Supabase injects `SUPABASE_URL`, `SUPABASE_DB_URL`, and publishable-key metadata into Edge Functions. Add the following secrets in **Supabase → Edge Functions → Secrets** before enabling Strava:

| Secret | Purpose |
|---|---|
| `STRAVA_CLIENT_ID` | Strava API application client ID |
| `STRAVA_CLIENT_SECRET` | Strava API application secret |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Random verification token for Strava webhook registration |
| `STRAVA_TOKEN_ENCRYPTION_KEY` | A separate random secret of at least 32 characters used to encrypt Strava OAuth tokens |
| `KNOWN_DAILY_APP_URL` | Optional; defaults to `https://known-daily.vercel.app` |

Never put Strava secrets or the token-encryption key in GitHub, Vercel client variables, or `config.js`. The function stores Strava tokens encrypted and the Apple Shortcut key as a one-way hash.

### Strava developer app

1. Create a Strava API application at [Strava Developers](https://www.strava.com/settings/api).
2. Set the Authorization Callback Domain to `xndyrshqfxatuoevhcqu.supabase.co`.
3. Copy the Client ID and Client Secret into the Supabase Edge Function Secrets above.
4. Generate separate random values for the webhook verification token and token-encryption key.
5. Connect Strava from **KNOWN Daily → Customize → Connected activity**. Approve activity read access. Then use **Sync now** to import recent activities.
6. Strava webhooks flag changes for a follow-up sync. Use **Sync now** after new or edited activities appear; the first connection imports up to the most recent 90 days.

New Strava API applications may have athlete limits/review requirements; treat this initial integration as a personal connection until Strava approves broader use.

## Apple Health Shortcut

A browser-based PWA cannot read HealthKit directly. On iPhone, use Apple's Shortcuts app as the bridge. Create a Shortcut named **Send to KNOWN Daily**:

1. In KNOWN Daily, open **Customize → Connected activity → Create Shortcut key**. Copy the key immediately; it is shown only once. If it is lost, generate a replacement key.
2. In Shortcuts, create a new shortcut and add three **Find Health Samples** actions:
   - Type **Steps**, date range **today**.
   - Type **Exercise Minutes**, date range **today**.
   - Type **Sleep**, start date between yesterday evening and today around noon. Sleep often starts before midnight, so do not filter only for samples starting today.
3. For Steps and Exercise Minutes, extract each sample's **Value** and sum the values. For Sleep, include only samples whose sleep state is asleep (for example, Core, Deep, or REM); exclude Awake and In Bed. Extract each included sample's **Duration** and sum the durations. Convert the sleep total from seconds to minutes.
4. Add **Get Contents of URL** with method **POST** and JSON request body:
   ```json
   {
     "day": "YYYY-MM-DD",
     "steps": 0,
     "exercise_minutes": 0,
     "sleep_minutes": 0
   }
   ```
   Replace the example values with the totals calculated above. Use the date you woke up as `day`, so last night's sleep appears on the morning's dashboard.
5. Use this URL:
   ```
   https://xndyrshqfxatuoevhcqu.supabase.co/functions/v1/known-activity-integrations?mode=apple-health-ingest
   ```
6. Add these request headers:
   - `Content-Type`: `application/json`
   - `apikey`: the KNOWN Daily Supabase publishable key already used by the app
   - `Authorization`: `Bearer ` followed by the one-time Shortcut key copied in step 1
7. Run the Shortcut once and confirm the response says `ok: true`. You can run it manually or add a Personal Automation in Shortcuts to run each morning.

Apple's Shortcuts **Find Health Samples** action is documented in [Apple's Shortcuts guide](https://support.apple.com/guide/shortcuts/intro-to-find-and-filter-actions-apd3c845e881/ios). Apple's Health app stores steps and sleep data from iPhone/Apple Watch; see [Apple's Health overview](https://support.apple.com/guide/iphone/intro-to-health-data-iphbb8259c61/26/ios).

## Testing checklist

- Confirm the migration is present and all five new tables have RLS enabled.
- Deploy the Edge Function and verify unauthenticated status requests return 401.
- Create a Shortcut key and send one valid sample day; verify only that user's daily summary is returned after sign-in.
- Verify invalid dates, negative values, and out-of-range metrics are rejected.
- Connect Strava and sync; confirm a ride/run appears once, with local start date and duration.
- Confirm Apple exercise minutes remain the dashboard total when Strava workouts are also present.
- Confirm sleep is attributed to the morning/wake-up date and Awake/In Bed periods are excluded.
- Confirm disconnecting either provider stops new imports and does not delete existing records.
