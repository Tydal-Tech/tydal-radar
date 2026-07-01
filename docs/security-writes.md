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

## After this
- Anon key can **read** `prospects`/`pipeline` but **cannot write** them — tampering
  via the public key is closed.
- Remaining exposure: anon can still **read** (scrape) the dataset. Phase 2 routes
  reads through the server too; deferred until CI/preview exist to verify safely.
