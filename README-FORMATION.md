# KNOWN Daily Formation practices — staged release

This is a **development PR**, not safe to merge until the migration has been applied and tested in the correct KNOWN Daily Supabase project.

## Features in this branch

- **Prayer:** daily time (initial goal 10 min), persistent intercessory request list, check off a request for a particular date, add dated updates, edit, mark answered and archive/restore.
- **Weekly gratitude:** ten editable items for each Sunday–Saturday week; count toward ten rather than a daily checkmark. Sunday displays a weekly prompt in Today. No push notifications.
- **Daily Notes:** notes for any selected day, backed up locally while saving to the user's private cloud account. Upload a photographed page to a separate private WebP bucket; optional on-device OCR from a browser-downloaded Tesseract.js library with a review-and-append workflow.

The home dashboard includes a Formation shortcut and a Formation tab. **These are separate practice screens, not yet new entries counted in the five-habit daily percentage.** That integration should be a later tested iteration, not a silent change to existing habit completion metrics.

### Deployment gate — Supabase GUI

1. Open your KNOWN Daily project in Supabase (check the project hostname against the public `config.js`).
2. Open **SQL Editor** → New query.
3. Review and run [migrations/20261104_formation_practices.sql](migrations/20261104_formation_practices.sql). It creates six tables, ownership-matching foreign keys, private RLS policies and a private `daily-note-photos` bucket. It doesn't touch the existing habit, writing or photo tables.
4. Verify all six RLS policies show on and the bucket is private.
5. Use two different real email test accounts: verify Account A cannot fetch, update, or delete Account B's requests, updates, checkoffs, notes or photos. Test uploads, archive/answered flow and repeat logins on iPhone and Mac.
6. Test weekly boundary across local midnight / DST, offline notes recovery, and OCR on both printed and handwritten pages. Record accuracy and show the OCR limitation before announcing the feature.
7. Only after these tests pass should you merge the PR and check that Vercel shows a Ready production deployment.

### Limitations / safety

- Handwritten OCR is **best effort** and can be poor for cursive; no OCR content is stored until the user taps **Save notes**. Tesseract.js v5 is fetched lazily from a public CDN when explicitly requested; language data downloads may require Internet and consume device memory. OCR executes in browser-side code; there is no dedicated OCR API upload.
- Directly loading a new remote script from a CDN is not as robust as bundling/self-hosting it. Self-host and pin the OCR dependency before a broad public launch.
- Current Prayer request editing uses basic browser prompts, an initial functional UI; replace with polished accessible forms before wide release.
- Default prayer goal is 10 minutes and not yet personalized across devices.
- Guest-demo text is local-only; guest photos are intentionally not persisted as a separate photo library.
- No notification permission is requested; Sunday gratitude is an in-app prompt, not a push notification.
- There is no conflict resolution for concurrent changes on two devices, and photo backups/export need further improvement.
- The existing native iPhone HEIC decoder remains dependent on browser support; try Safari first.

## Acceptance tests

GitHub Actions runs `node --check` and `node --test`. The new test covers basic week calculation, table RLS presence, and core integration wiring. This is *not* a live cross-account RLS test.

Related issues: #5 weekly gratitude, #6 prayer list, #7 notes and OCR.
