import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverDb';
import { budgetStatus } from '@/lib/agentBudget';
import { scopesFor } from '@/lib/agentLog';
import { hasIngestAuth } from '@/lib/opsAuth';

// Budget pre-check for EXTERNAL agents (Engineering runs in GitHub Actions) that
// can't call runAgent in-process. An Actions job calls this first and aborts if
// blocked. Token-gated (OPS_INGEST_SECRET), service-role. Fail-OPEN: if the meter
// is down we don't block engineering work — same posture as runAgent.
export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!hasIngestAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const department = searchParams.get('department') ?? '';
  const role = searchParams.get('role') ?? '';
  if (!department || !role) {
    return NextResponse.json({ error: 'department and role are required' }, { status: 400 });
  }

  try {
    const status = await budgetStatus(scopesFor(department, role));
    // Touch the client only to surface a clear "not configured" without a 500.
    serviceClient();
    return NextResponse.json({
      blocked: status.blocked,
      worst: status.worst
        ? { scope: status.worst.scope, period: status.worst.period, pct: Math.round(status.worst.pct) }
        : null,
    });
  } catch {
    return NextResponse.json({ blocked: false, worst: null, configured: false });
  }
}
