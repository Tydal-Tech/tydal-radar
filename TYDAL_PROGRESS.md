# Tydal Radar — Flagship Campaign Progress

Loop memory for the autonomous improvement campaign. Newest entries on top.

## Baseline (2026-06-30)
- `tsc --noEmit`: green. `next build`: green.
- `eslint .`: **16 errors, 5 warnings** (mostly react-hooks rules: latest-ref-during-render in ClusteredMarkers/SheetShell/ProspectSheet, set-state-in-effect in useGeolocation; `require()` in the Node scraper).
- **No test framework** present (package scripts: dev/build/start/lint/gen-icons).
- Stack: Next 16 (App Router, Turbopack), MUI, Supabase (anon key), Google Maps (Places New + Advanced Markers), framer-motion, hand-written SW, Vercel.

## Deferred / open questions (NOT to be done autonomously)
- **Auth/RLS security hardening** — the Supabase anon key ships in the public bundle and RLS is `for all to anon using(true) with check(true)`, so the DB is read/write/deletable by anyone, bypassing the APP_PASSWORD UI gate. This is the biggest real gap, but touching auth is a STOP condition in the goal → **requires explicit user confirmation before implementing.**
- **Team / multi-user mode** — explicitly EXCLUDED by the user. Do not build.
- **CI via GitHub Actions** — blocked: the saved token lacks `workflow` scope, so `.github/workflows/*` can't be pushed. Logged; revisit if token is upgraded.

## Candidate queue (highest-leverage first)
1. Test infrastructure (Vitest) + pure-logic coverage (contracts/stages/icp/directions/analytics). ← in progress
2. Lint → green (safe fixes: latest-ref → effect; remove dead eslint-disable; exclude Node scripts from TS rules).
3. Offline-first: cache prospects (IndexedDB) + optimistic pipeline writes + sync queue (field tool on poor connectivity).
4. Data quality: fetch Places `businessStatus`, flag/skip permanently-closed; refresh mutable fields.
5. Follow-up push notifications (PWA web push) for due follow-ups.
6. Accessibility pass (aria labels, contrast, tap targets, scalable text).
7. Perf: profile ~2.6k Advanced Markers on mid devices; lighten renderer if it janks.
8. Route/day planning across filtered prospects.

## Log
- (campaign start) Created CHANGELOG.md + this file. Baseline captured above.
