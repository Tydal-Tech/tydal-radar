import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverDb';

// Hit by a Vercel Cron (see vercel.json) every 3 days so the free-tier Supabase
// project doesn't auto-pause from inactivity. Runs the cheapest possible query —
// a head-only exact count of `prospects` — and touches neither Google Places nor
// any write. Uses the service-role client (anon can no longer read prospects
// after the Phase 2 lockdown). Excluded from the password gate in proxy.ts;
// instead it authenticates cron callers with CRON_SECRET (see below).
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Vercel injects `Authorization: Bearer ${CRON_SECRET}` on cron invocations
  // when CRON_SECRET is set in the project. Enforce it only when configured, so
  // the endpoint is locked down in production yet still verifiable before the
  // secret exists.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { count, error } = await serviceClient()
    .from('prospects')
    .select('*', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, prospects: count ?? 0, at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
