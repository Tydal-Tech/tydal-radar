# Changelog

All notable changes to Tydal Radar are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); this project is pre-1.0.

## [Unreleased]

### Added
- Time-series growth signals (the market-intel moat): the monthly snapshot now records review counts, and `diff-snapshots.mjs` reports "just opened" businesses (no cleaning contract yet), "gone / likely closed", and "fastest growing" by review momentum. In-app, a `first_seen` column powers a "✦ New" badge on the prospect card and a +20 lead-score boost for newly-opened businesses (requires the `first_seen` migration — see below).
- Co-location / decision-maker signal: prospects are grouped by building, so the card shows whether a business is a **sole occupant** (controls its own cleaning — a direct-pitch target) or **shares its address** with others (cleaning likely handled by a property manager — a different motion). ~75% of prospects are sole occupants.
- Automated market refresh (local, monthly): `scripts/refresh-and-report.sh` + a launchd job re-scrape the full city, then diff the two newest snapshots into a "+N new · -N gone" report with a Notification Center ping. The scraper now writes a per-run `market-snapshots/` found set (reveals openings **and** closures, unlike DB backups which only show growth); `diff-snapshots.mjs` defaults to those. See docs/market-refresh.md.
- Lead scoring / "hot list": a 0–100 `leadScore` (opportunity by stage + size/quality from reviews & rating + timing from contract/follow-up urgency + website) ranks prospects by who to work next. Search's empty state now shows the top-scored prospects ("work these next"), and a colour-coded score badge appears on Search rows and the prospect card.
- Prospect enrichment: the scraper + in-app Refresh now capture Places `rating`, review count, and website, shown on the prospect card. Backfill existing rows with `node --env-file=.env.local radar-grid-scrape.js --update` (a re-scrape that overwrites instead of insert-only).
- Market-intelligence analytics: a "Market coverage" table (size / worked / open per ICP segment — surfaces whitespace) and a "Competitors" breakdown (incumbents from `current_provider`) in the Stats sheet.
- Market change over time: `scripts/diff-snapshots.mjs` diffs two backup snapshots to show businesses added (growth) vs gone (churn/closed), with a per-type breakdown.
- Follow-up push notifications (opt-in): a "Remind me" toggle in Follow-ups subscribes the device to Web Push; a daily Vercel Cron pushes "N follow-ups due today" so reps act without opening the app. Requires one-time VAPID/Supabase setup — see docs/push-setup.md.
- Route planning ("Plan my walk"): a map control that orders your nearest unworked (not-knocked) prospects into an efficient nearest-neighbour walking sequence — numbered stops with per-leg distance, total distance, tap-to-open, and per-stop Directions.
- Canvassing efficiency (uses your GPS location, one shared watcher): Search results sort nearest-first; distance to each prospect shows on Search/Follow-up rows and the prospect card; a "Near me · not knocked" one-tap filter surfaces unworked prospects within ~1 km; and tapping a stage chip on the card now saves+closes in one tap (except "lost", which still asks for a reason).
- Accessibility: the Search / Follow-ups / Contracts / Stats pull-up sheets and the prospect card are now proper labelled dialogs (`role="dialog"`, `aria-modal`, `aria-label`) and dismiss on the Escape key.
- Offline-first: prospects/pipeline are mirrored in IndexedDB and render instantly (stale-while-revalidate when online); prospect edits save optimistically to a local outbox and sync to Supabase on reconnect/foreground, so edits made in a dead zone are never lost. A top-left status pill shows offline / pending-count / syncing state (hidden when synced).
- Citywide grid scraper (`radar-grid-scrape.js`) — tiles Montreal into ~2.2 km cells to beat Google Places' 60-result/search cap; `--only=<types>` flag for targeted runs.
- `medical` ICP type (clinics/doctors), distinct from professional `office`.
- `veterinary` ICP type.
- Supabase keep-alive (Vercel Cron `/api/keepalive`, every 3 days) to prevent free-tier auto-pause.
- Multi-select ICP type filter in FilterPanel.

### Changed
- `office` now means professional services (lawyer / accounting / real estate), merged into one bucket.

### Fixed
- iOS PWA map dead-zone: the map now flex-fills the space above the tab bar.
- Prospect fetch loaded only the first 1000 rows (PostgREST cap); now paginated.
- Notes/fields in the prospect sheet sat behind the iOS keyboard; now scrolled into view above it.
