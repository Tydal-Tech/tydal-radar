# Changelog

All notable changes to Tydal Radar are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); this project is pre-1.0.

## [Unreleased]

### Added
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
