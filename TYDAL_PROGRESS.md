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
1. ✅ DONE — Test infrastructure (Vitest) + pure-logic coverage (contracts/stages/icp/analytics): 136 tests.
2. 🔶 PARTIAL — Lint: safe subset done (Node-script `require` exemption, dead `eslint-disable` removed, unused `ICP` import pruned). 21→17 problems. **Remaining 15 errors are all `react-hooks/refs` + `react-hooks/set-state-in-effect`** across the interactive core (AppShell, MapView, DataProvider, ProspectSheet, ClusteredMarkers, SheetShell). Deferred deliberately: (a) latest-value-ref reads/assigns are mechanically fixable (move to `useState` lazy-init / `useEffect`), safe since refs are read only in async handlers — do per-file with care; (b) several `set-state-in-effect` cases (toasts in MapView, viewport sync in AppShell, initial load in DataProvider, layout-measure in ProspectSheet) are legitimate external-sync patterns the rule flags heuristically — fix case-by-case, do NOT mass-refactor blind (no device testing here). 2 warnings (ref-in-cleanup, missing `close` dep) also queued.
3. Offline-first: cache prospects (IndexedDB) + optimistic pipeline writes + sync queue (field tool on poor connectivity).
4. Data quality: fetch Places `businessStatus`, flag/skip permanently-closed; refresh mutable fields.
5. Follow-up push notifications (PWA web push) for due follow-ups.
6. Accessibility pass (aria labels, contrast, tap targets, scalable text).
7. Perf: profile ~2.6k Advanced Markers on mid devices; lighten renderer if it janks.
8. Route/day planning across filtered prospects.

## Log
- 2026-06-30 — react-hooks/refs (latest-value assigns): moved `ref.current = x` out of render into an effect in ClusteredMarkers (views/selected/onSelect), SheetShell + ProspectSheet (atFull). Verified readers run only in async handlers / later effects, so ordering is preserved. Lint 13→8 errors. Tests 136, tsc, build green. Remaining 8 = `set-state-in-effect` (legitimate patterns) — left as-is, NOT downgrading the rule to fake green.
- 2026-06-30 — react-hooks/refs: AppShell + MapView shared MotionValue now via lazy `useState(() => motionValue(0))` instead of `useRef(...).current` (identical stable instance, no gesture-logic change). Lint 15→13 errors. Tests 136, tsc, build green. Next: remaining refs (latest-value assigns in ClusteredMarkers/SheetShell/ProspectSheet → move to effect), then set-state-in-effect case review.
- (campaign start) Created CHANGELOG.md + this file. Baseline captured above.
- 2026-06-30 — Added Vitest (`npm test`) + 136 unit tests across contracts/stages/icp/analytics (pure logic; node env). tsc + build green.
- 2026-06-30 — Lint safe subset: Node-script `require` exemption, removed 2 dead `eslint-disable` directives, pruned unused `ICP` import in Contracts. 21→17 problems; tests/tsc/build green. Remaining 15 = react-hooks rules across interactive core (see queue #2) — deferred for careful per-file work. Next: react-hooks/refs latest-value fixes (mechanical, lowest-risk first: AppShell/MapView `useRef(motionValue()).current` → lazy `useState`), then expand tests toward component/integration coverage.
