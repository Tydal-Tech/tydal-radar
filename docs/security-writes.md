# Database lockdown — writes (Phase 1)

The app ships the Supabase **anon key** in its public JS bundle (the `_next/static`
assets aren't behind the password gate), so anyone can extract it. Combined with
permissive RLS, the database was effectively public read/write. Phase 1 closes
the **write** hole; reads are a later phase (they touch the offline load path and
should wait for CI + preview deploys).

## What changed (code)

- `lib/serverDb.ts` — `serviceClient()` (service-role, server-only, bypasses RLS)
  + `hasValidSession()` (mirrors the proxy password gate).
- `app/api/data/pipeline` (POST) and `app/api/data/prospects` (POST) — the two
  writes, now password-gated + service-role.
- `lib/db.ts` — `savePipeline` / `upsertProspects` POST to those routes instead
  of writing via the anon client. Reads (`fetchProspects` / `fetchPipeline`) and
  push subscription writes are unchanged (still anon for now).

## Go-live sequence (do in this order)

1. **Deploy** the code (push → Vercel auto-build). Requires `SUPABASE_SERVICE_ROLE_KEY`
   in the Vercel env (already present — the notify cron uses it).
2. **Verify the live app**: open a prospect, change its stage, confirm it **saves**
   (that exercises the new write route). Confirm data still loads.
3. **Only then**, run this in Supabase → SQL Editor to deny the anon key writes
   (reads stay open; the service-role routes bypass RLS so saving still works):

```sql
drop policy if exists "anon insert prospects" on public.prospects;
drop policy if exists "anon update prospects" on public.prospects;
drop policy if exists "anon insert pipeline"  on public.pipeline;
drop policy if exists "anon update pipeline"  on public.pipeline;
```

If step 2 fails, do **not** run the SQL — roll back the deploy in Vercel and
report it.

## Phase 2 — reads (this branch: `read-lockdown`)

Reads now go through the server too: `GET /api/data/prospects` and
`GET /api/data/pipeline` (service-role, paginated), and `db.ts`
`fetchProspects`/`fetchPipeline` call them. `keepalive` moved to the
service-role client (it read `prospects` via anon before). After this deploys
and the app is verified loading data, deny the anon key **all** access:

```sql
drop policy if exists "anon read prospects" on public.prospects;
drop policy if exists "anon read pipeline"  on public.pipeline;
```

After that the anon key can neither read nor write `prospects`/`pipeline` — the
dataset can no longer be scraped with the public key. (Push subscriptions remain
anon — a separate, low-sensitivity table.)

Order, as before: **deploy → verify the app still loads your prospects → only
then run the SQL.** If loading breaks, don't run it; roll back the deploy.

## After Phase 1 (writes)
- Anon key can **read** `prospects`/`pipeline` but **cannot write** them — tampering
  via the public key is closed.
