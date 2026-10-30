# KNOWN Daily — KNOWN Formation Labs

**Version 0.1 · A personal development PWA**

Daily checklist, customizable habit goals,  autosaving writing space, sequential Bible reading, a compressed daily photo, and a history view. Works on phones, tablets, and desktop browsers. No build step, subscription, or paid services are required for initial personal use.

## Quickest way to TRY it today (no database required)

1. Download the `known-daily-starter.zip` file from ChatGPT.
2. Open **https://vercel.com/drop** while signed into your existing Vercel account.
3. Drag the **ZIP** onto the page, choose a project name like `known-daily`, and deploy.
4. Open the public `*.vercel.app` URL assigned by Vercel. You can use the app immediately in **local demo mode**.
5. On iPhone/iPad: in Safari, use **Share > Add to Home Screen**. On a computer, use the app's URL or browser's Install option when offered.

> **IMPORTANT: Local demo mode is not cross-device syncing.** Its habits and writing remain in that particular browser's localStorage; photos live in IndexedDB in that browser. Clearing website data, uninstalling, private-browsing restrictions, or switching devices may remove or hide these records. Use the JSON Export option for a backup of non-photo data. Don't use demo mode for irreplaceable journal data.

## Turn on private cross-device sync (recommended)

1. **Ideally make a separate Supabase project** named `known-daily` in your **existing Supabase account**. This keeps your private journal and photographs separate from other KNOWN Formation Labs products. Supabase Free currently allows only two active projects across eligible organizations. If both are occupied, this SQL uses `daily_*` table names and can run inside an existing project, but that shares project-wide operational resources; make sure that is acceptable before proceeding. Choose a secure database password and save it outside the app.
2. In the Supabase project dashboard, open **SQL Editor**, paste the full contents of `supabase-setup.sql`, and run the SQL. Then run `supabase-verify.sql` to confirm the 6 new `daily_*` tables show RLS enabled and the `daily-photos` bucket is **private**.
3. In Supabase **Project Settings / API** or **Connect**, find:
   - Your **Project URL** (looks like `https://yourproject.supabase.co`).
   - Your **publishable key** (or legacy `anon` public key). Never use a `service_role`, `sb_secret_...`, or other secret key here.
4. On your Mac, unzip the starter, open `config.js` in any text editor and fill in both empty strings:

   ```javascript
   window.KNOWN_DAILY_CONFIG = {
     url: 'https://YOUR-PROJECT.supabase.co',
     publishableKey: 'YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY'
   };
   ```

   The public key can safely appear in frontend code **because the database and storage RLS policies restrict all personal data to the signed-in user**. **Do not skip step 2.**
5. **Rezip the contents of the folder**, so `index.html` sits at the top level of the ZIP. Deploy this configured copy using **https://vercel.com/drop** as a new project. (If updating an existing Vercel project, prefer linking a Git repository or redeploying with Vercel CLI; the initial Drop flow creates a new project.)
6. Copy the new Vercel production URL. In Supabase open **Authentication > URL Configuration**. Set **Site URL** to `https://your-app.vercel.app` and add the exact URL (or `https://your-app.vercel.app/**`) under **Redirect URLs**. Email authentication must be enabled under **Authentication > Providers > Email**.
7. Open the configured app, visit **Customize > Account & syncing**, enter your email, and click **Email me a sign-in link**. Open that link on the device where you requested sign-in. You should then see **Synced** in the header. Sign in with the same email on your other devices.

Supabase's default mail sender has restrictions and rate limits for development use. For broader use, configure your own SMTP provider. Check Supabase's current authentication and email limits before rolling this out to others.

## What's built in v0.1

- **Today:** daily dashboard with wake-time, Bible chapters, word count, activity and bedtime. Tap circular icons for simple self-reported habits; tap writing, reading, or activity rows to open their respective activities.
- **Customize:** add/edit/remove habits; change time/word/chapter/minute targets; set where the sequential Bible plan should resume.
- **Writing:** date-based editable journal, word counter, autosave on pauses, manual completion after reaching the daily goal. Stored as text in the database (`daily_writing`), one entry per calendar day.
- **Bible:** continuous book-by-book chapter order (66 books); read a chapter at Bible Gateway (WEB public-domain translation) and tap **I finished** to record it. Daily goal automatically marks complete.
- **Activity:** enter minutes; log complete once daily goal is reached.
- **Photo:** one compressed photo per day, replaceable. Cloud mode stores the private WebP file at `daily-photos/<user-uuid>/YYYY-MM-DD.webp`. Image is resized to fit within 960 px on its longer side; exact final size depends on photo content.
- **History:** 21-day completion view, aggregate writing and reading totals, and photo grid.
- **Backup:** Export JSON for text, habits and progress. **Photos are not included**; back up your images separately through Supabase storage or your original camera library.

## Data model and privacy

Supabase Auth manages account sessions; Postgres tables `daily_profiles`, `daily_habits`, `daily_completions`, `daily_writing`, `daily_readings`, and `daily_photos` hold personal records. Every table has row-level security checking `auth.uid() = user_id`. The image storage bucket is private, with user-ID folder policies and short-lived signed viewing links. No secret backend credentials are included in frontend code.

In local demo mode, browser storage is private to that browser profile but **is not protected by Supabase authentication**. Anyone with access to that unlocked browser profile may be able to view it.

## MVP limitations (intentional)

- No automatic migration of your local demo habits to your cloud account; export your records first and start fresh in cloud mode.
- No reminders/notifications yet; marking wake/bedtime means **you report having met the goal** (it does not verify sleep or wake times).
- Bible text is linked to Bible Gateway rather than embedded. This requires internet access to read the passage, and the app does not independently verify chapters were read.
- Cloud sync reads from Supabase when signing in, when returning to a foreground dashboard, and when you tap **Refresh from cloud**. Concurrent edits to the same day on multiple devices can use last-write-wins behavior; avoid simultaneous editing in multiple tabs.
- Full offline cloud editing and reconciliation is not supported. If you are offline, changes may fail to save to Supabase; check the app's save status before leaving.
- Writing currently supports one entry per day, even if you create multiple writing habits. Reading uses one sequential Bible plan shared by all reading habits.
- Very large exports and photos require separate backup workflows; this is an early MVP, not a full archival service.
- This app is not intended to host sensitive medical information or replace professional healthcare guidance.

## Files

- `index.html`, `styles.css`, `app.js`: the complete mobile-first app
- `manifest.webmanifest`, `sw.js`, `assets/`: PWA installation and app icons
- `config.js`: public Supabase configuration (blank by default)
- `supabase-setup.sql`: schema, RLS, and private photo storage bucket
- `supabase-verify.sql`: optional read-only checks to run in Supabase SQL Editor after setup
- `vercel.json`: optional static hosting headers and deployment settings

## Local preview for developers

On a Mac with Python installed, unzip, open Terminal inside the project folder, then run:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Modern browsers support browser storage in localhost. A file opened via `file://` is **not** an adequate PWA preview.

## Brand

**KNOWN Daily** · **KNOWN Formation Labs** · **Pay Attention**.

Built as a small, independent KNOWN Formation Labs product. This first version is not coupled to Organizational Behavior Lab's database or frontend.
