# Spanish Collector – Minimal UI

This repository hosts a tiny GitHub Pages app to review, edit, and export your saved Spanish phrases stored in Supabase.

## Quick start

1. Open `app.js` and set:
   - `SUPABASE_URL` = `https://YOUR-PROJECT.supabase.co`
   - `SUPABASE_ANON_KEY` = your project's anon public key (Project Settings → API)

2. In your Supabase Dashboard → **Authentication → URL Configuration**, add your Pages URL to **Redirect URLs**, e.g.:
   `https://<username>.github.io/<repo>/`

3. Enable GitHub Pages in this repo:
   - Settings → Pages → Source: **Deploy from a branch**
   - Branch: `main` (or `master`), Folder: **/** (root)

4. Visit your Pages URL, sign in via magic link, and start reviewing/editing phrases.
   - Use the **Copy access token** button for quick API tests during development.

## Notes
- This UI assumes you have a `phrases` table with RLS policies as described in your backend setup.
- CSV export is client-side, no server required.
