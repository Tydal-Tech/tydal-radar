# Changelog

All notable changes to Tydal Radar are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); this project is pre-1.0.

## [Unreleased]

### Added
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
