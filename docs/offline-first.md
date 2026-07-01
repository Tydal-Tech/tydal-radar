# Offline-first — design spec (for review, not yet built)

Status: **DRAFT / awaiting sign-off.** Tydal Radar is a door-to-door field tool
used in basements and dead zones. Today every read and write hits Supabase live,
so on a flaky/absent connection the map shows nothing and — worse — a saved
stage/note is **lost** (see "current write path" below). Goal: the app works
fully offline for reads, and edits are never lost.

## Constraints
- **iOS PWA is the target.** iOS Safari does **not** reliably support the
  Background Sync API, so the design must NOT depend on it — sync must happen on
  the `online` event + app foreground + on save, all while the app is open.
- **Single-tenant** (no multi-user, per product decision) → last-write-wins is
  an acceptable conflict policy; concurrent edits from two devices are rare.
- **No new backend.** Reuse the existing Supabase tables + anon key and the
  current write path (`lib/db.ts`).
- Data volume is small (~2.6k prospects + pipeline ≈ a few MB) → IndexedDB is
  comfortable.

## Current data flow (for reference)
`DataProvider` holds `prospects: Prospect[]` + `pipelineMap: Record<id, Pipeline>`
→ merged into `views`.
- `loadFromCache()` (misnamed — it's a **network** fetch): `fetchProspects()` +
  `fetchPipeline()` on mount.
- `save(id, patch)`: optimistic `setPipelineMap`, then `persistPipeline` (network).
  **On any error it rolls back the optimistic update and throws** → offline edits
  are discarded. This is the core bug offline-first fixes.
- `refresh()`: `pullProspects` (Places) → `upsertProspects` → reload.

## Architecture

### 1. Local store — `lib/offline.ts` (new)
IndexedDB wrapper (via `idb`, see deps) with object stores:
- `prospects` (keyPath `place_id`) — mirror of fetched prospects.
- `pipeline` (keyPath `place_id`) — mirror of fetched pipeline rows.
- `outbox` (keyPath `place_id`) — pending pipeline writes. Keyed by `place_id`
  so a re-edit of the same prospect overwrites its pending entry (final state
  wins — matches LWW).
- `meta` — `lastSyncedAt`, schema version.

API (all promise-based, pure enough to unit-test with `fake-indexeddb`):
`readProspects()`, `readPipeline()`, `writeProspects(rows)`, `writePipeline(rows)`,
`putPipeline(row)`, `enqueue(row)`, `outboxAll()`, `dequeue(place_id)`.

### 2. Reads — stale-while-revalidate (`DataProvider.load()`)
1. Read prospects + pipeline from IndexedDB → set state → render **immediately**
   (works offline, instant cold-start).
2. If online, fetch from Supabase in the background → write-through to IndexedDB
   → update state. (Same `fetchProspects/fetchPipeline`; just cached after.)
3. `refresh()` additionally write-throughs the pulled prospects to IndexedDB.

First-ever launch while offline → nothing cached → a clear empty state
("Connect once to load prospects").

### 3. Writes — optimistic + outbox (`DataProvider.save()`)
1. Build `next` Pipeline (unchanged logic), `setPipelineMap` optimistically,
   and `putPipeline(next)` to IndexedDB (durable across reloads).
2. `enqueue(next)` into the outbox.
3. `flushOutbox()` (below). **Do NOT roll back on a network/offline error** —
   the edit stays applied + queued. Only roll back on a genuine server rejection
   (HTTP 4xx from PostgREST), which indicates bad data, not connectivity.

### 4. Sync — `flushOutbox()`
Read all outbox rows → `persistPipeline` each → `dequeue` on success; stop on the
first network failure (still offline). Triggered on: every `save`, the `window`
`online` event, and app foreground (`visibilitychange` → visible) / load.
Guarded by an in-flight flag so triggers don't overlap.

### 5. Sync status (Phase 3)
`DataProvider` exposes `{ online: boolean, pending: number, syncing: boolean }`.
A small indicator (near the count pill / refresh FAB) shows: offline dot ·
"N pending" · a spinning state while flushing · nothing when synced+online.

## Files
- **New** `lib/offline.ts` — IndexedDB store + outbox.
- **New** `lib/offline.test.ts` — unit tests via `fake-indexeddb` (store round-trip, outbox enqueue/overwrite/dequeue, flush LWW). Browser-independent → verifiable in CI.
- **Change** `components/DataProvider.tsx` — read-through + SWR load; optimistic+outbox save (no rollback on offline); flush triggers; expose sync state.
- **Change (Phase 3)** a small status indicator in `MapView` (or AppShell).
- **No SW change** for data (IndexedDB is separate from the SW asset cache). To
  verify: confirm `public/sw.js` does not intercept cross-origin Supabase
  requests (it shouldn't — it's same-origin navigation network-first).

## Dependencies
- `idb` (~1 KB, MIT, actively maintained by Jake Archibald) — ergonomic IndexedDB. *Alternative:* hand-roll a minimal wrapper (no dep) — slightly more code.
- `fake-indexeddb` (devDep, MIT, maintained) — lets the store logic be unit-tested without a browser.

## Conflict policy
Last-write-wins keyed by `place_id`. `pipeline.updated_at` is bumped by the
existing DB trigger on upsert. Single-tenant → conflicts are rare and LWW is
acceptable. (If multi-device becomes common later, revisit with per-field merge
or updated_at guards.)

## Testing / verification
- **Unit (CI, no browser):** `lib/offline.ts` + outbox/flush logic via
  `fake-indexeddb`. This is the bulk of the risk and is fully testable here.
- **Manual/browser (needs the extension or a device):** toggle offline in
  devtools → confirm reads render from cache, a stage edit persists across a
  reload while offline, and the outbox flushes on reconnect. I can't verify this
  part autonomously without the browser connected.

## Phased rollout (each phase shippable + revertible)
1. **Offline reads** — `lib/offline.ts` + read-through/SWR in `load()`. App shows last-known data offline.
2. **Offline writes** — outbox + optimistic-persist + `flushOutbox()`. Edits survive offline and sync on reconnect. (Biggest correctness win.)
3. **Sync status UI** — the indicator.

## Open questions (need your call before I build)
1. **`idb` dependency** vs hand-rolled IndexedDB (no dep)? *Recommend `idb`.*
2. **Write-failure semantics:** OK to change `save()` so offline/network errors
   keep the edit + queue it (only rolling back on a server 4xx)? *Recommend yes —
   it's the whole point.*
3. **Sync indicator:** place it by the count pill, or leave placement to my
   judgment? 
4. **Scope now:** build all 3 phases, or just Phase 1+2 (reads+writes) and defer
   the status UI?
