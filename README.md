# Tydal Radar

A mobile-first, installable PWA for door-to-door commercial-cleaning sales in
Montreal. It maps ICP prospects (daycares/CPEs, dental clinics, gyms, small
offices/clinics) across Ville-Marie, Shaughnessy Village, Plateau-Mont-Royal,
and Côte-des-Neiges–NDG, and tracks a per-prospect sales pipeline.

- **Map** — full-screen Google map, teardrop pins colored by pipeline stage,
  filter chips (neighborhood / type / stage with live counts), search.
- **Prospect sheet** — tap a pin for details, Call, Directions, stage, note,
  and a follow-up date.
- **Follow-ups** — every dated prospect, sorted, with overdue ones in red.
- **Refresh prospects** — pulls fresh ICP businesses from Google Places (New)
  client-side and caches them in Supabase, so normal map loads cost nothing.

## Stack
Next.js (App Router) + TypeScript · MUI · `@vis.gl/react-google-maps` ·
Supabase · hand-written service worker. Deploys on Vercel.

## Local setup
1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in the values:
   - `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — key with **Maps JavaScript API** and
     **Places API (New)** enabled.
   - `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` — a Map ID (Google Cloud → Map Management;
     required for the colored Advanced Markers).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the
     publishable key).
   - `APP_PASSWORD` — the shared gate password (server-only; no `NEXT_PUBLIC_`).
3. Run the SQL in `SUPABASE.sql` once in the Supabase SQL editor.
4. `npm run dev` → http://localhost:3000

Regenerate the app icons after editing `public/icons/icon.svg` with
`npm run gen-icons`.

## First run
Log in with `APP_PASSWORD`, then tap **Refresh prospects** once to populate the
map. After that the map loads from the Supabase cache — Google is only queried
when you tap Refresh again.

> The Google Maps JavaScript SDK caps Text Search at 20 results per query and
> does not expose page tokens, so each (type × neighborhood) returns up to 20
> results, deduped. Plenty for these neighborhoods; a dense combo can be split
> into a grid later if needed.

## Add to Home Screen (iPhone)
1. Open the deployed URL in **Safari** (not Chrome — iOS only installs PWAs
   from Safari).
2. Tap the **Share** button (square with an up-arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Launch **Tydal Radar** from the home screen — it opens full-screen with no
   browser chrome, like a native app.

## Deploy (Vercel)
1. Push the repo to GitHub and import it in Vercel (framework auto-detected as
   Next.js).
2. Add the five environment variables above in **Project → Settings →
   Environment Variables** (Production + Preview).
3. Restrict the Google Maps key by **HTTP referrer** to your Vercel domain
   (and `http://localhost:3000/*` for local dev).
4. Deploy, then Add to Home Screen on your iPhone.
