# KNOWN Daily v0.2 — Bible reader integration

This package updates the original KNOWN Daily static PWA with an in-app, dynamically loaded Bible reader. **It is not already deployed.**

## IMPORTANT: rotate the key

The API.Bible key previously posted in chat should be treated as exposed. Generate/rotate it through https://api.bible/ before using it in production. The key is not included anywhere in this archive.

## BEFORE deployment

1. **Keep your existing `config.js`.** The included `config.js` is deliberately blank. Copy your configured Supabase URL and publishable key into this version of `config.js` (never a service-role/secret key).
2. Keep using the same KNOWN Daily Supabase project. This release needs **no SQL schema changes**. It stores the selected Bible ID in `daily_profiles.settings` and reading completion in `daily_readings` as before.
3. Confirm Supabase Email Auth works in your production website. In-app Scripture requests intentionally require a logged-in user to protect your API quota.
4. In your API.Bible dashboard, open **Plan → Edit Bible Licenses**. Enable NIV/NLT if available for your plan. The app discovers accessible English translations dynamically; **having an API key does not itself license NIV or NLT**.

## Add three Vercel Environment Variables

In https://vercel.com/dashboard → KNOWN Daily project → Settings → Environment Variables add:

- `API_BIBLE_KEY` = your newly rotated API.Bible key (secret; never expose in frontend files)
- `KNOWN_SUPABASE_URL` = the same `https://...supabase.co` URL used in `config.js`
- `KNOWN_SUPABASE_PUBLISHABLE_KEY` = the same public Supabase publishable/anon key used in `config.js`

Choose **Production** (and Preview if appropriate). Save, then **redeploy** so the function receives the new variables. Do not paste keys into chat.

## Deploy this updated source to the SAME Vercel project

Vercel Drop commonly creates a NEW project, so to update your current address, use Git import or Vercel CLI. On your Mac, unzip this archive and run Terminal from the folder containing `index.html`:

```bash
npx vercel login
npx vercel link
npx vercel --prod
```

When linking, select your **existing KNOWN Daily** project (not your other KNOWN Formation Labs app). Node.js is required; use https://nodejs.org if `npx` is missing. There is no frontend build step. Set the Vercel framework preset to **Other** if prompted. Vercel detects the `api/bible.mjs` serverless function in this static project.

## Testing

1. Open the deployed site in Safari and sign into your Supabase-backed KNOWN Daily account.
2. Visit Bible reading. The translation menu should show the English Bible versions authorized for your API.Bible key.
3. Select NLT or NIV if offered. The text of the next chapter should appear inside the app, along with its copyright statement.
4. Complete a chapter. It should load the next chapter and update your daily count. Refresh and check progress persists.
5. If you see *Vercel environment variables are missing*, confirm the 3 names and redeploy. If no NIV/NLT shows, check Bible licensing in API.Bible. If `/api/bible` returns a 404, the `api/` directory was not deployed—use Vercel CLI/Git instead of a static-only uploader.

## Security and licensing notes

- The publisher key is exclusively accessed on Vercel via `process.env.API_BIBLE_KEY`. No key is in any frontend file.
- `api/bible.mjs` validates Supabase bearer session against your project before requesting Scripture, reducing abuse of the publisher quota.
- Text is fetched on demand (not stored in Supabase) with no-store response headers; only reading progress and translation preference are persisted.
- Copyright is shown beside the content; the API.Bible FUMS web usage tracker is included for its v1 and newer response formats. **Verify FUMS logging in production** as the legacy and new API formats differ.
- Your Bible publisher licensing rights and daily limits depend on your API.Bible account. A free API key does not guarantee NIV/NLT access.
- If not signed in, the old external WEB reading link remains available and the chapter checklist can still be logged in local demo mode.

## Files

- `api/bible.mjs` — authenticated serverless Bible proxy (new)
- `app.js`, `index.html`, `styles.css`, `sw.js` — updated PWA
- `config.js` — blank safe template; must copy your existing Supabase public settings
- `supabase-setup.sql` — original setup, no changes necessary if already installed
- `.env.example` — variable NAMES only, not secrets
