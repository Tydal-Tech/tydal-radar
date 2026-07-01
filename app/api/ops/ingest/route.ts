import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverDb';
import { scopesFor, runCostColumns, scheduleBudgetAlert } from '@/lib/agentLog';
import { raiseTask } from '@/lib/agentTasks';
import { parseIngest } from '@/lib/opsIngest';
import { hasIngestAuth } from '@/lib/opsAuth';

// Report a COMPLETED external run (an Engineering agent in GitHub Actions) into
// the same agent_runs table the in-process seam writes — one meter, two doors.
// Reuses runCostColumns + scheduleBudgetAlert so external and in-process rows are
// identical and alerts fire the same way. Token-gated (OPS_INGEST_SECRET),
// service-role, excluded from the app-password gate (proxy.ts).
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!hasIngestAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let input;
  try {
    input = parseIngest(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'invalid body' }, { status: 400 });
  }

  let db;
  try {
    db = serviceClient();
  } catch {
    return NextResponse.json({ error: 'ops not configured' }, { status: 503 });
  }

  const cols = runCostColumns(input.model, input.usage);
  const row = {
    role: input.role,
    department: input.department,
    model: input.model,
    effort: input.effort,
    triggered_by: input.triggeredBy,
    status: input.status,
    escalated: input.escalated,
    ...cols,
    duration_ms: input.durationMs,
    request_id: input.requestId,
    error: input.error,
    meta: input.meta,
  };

  let runId: string | null = null;
  try {
    const { data, error } = await db.from('agent_runs').insert(row).select('id').single();
    if (error) throw error;
    runId = (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'insert failed' }, { status: 500 });
  }

  // Approvals queue (best-effort) + threshold alert (post-response, best-effort).
  if (input.task) {
    await raiseTask(db, {
      kind: input.task.kind,
      title: input.task.title,
      detail: input.task.detail,
      link: input.task.link,
      role: input.role,
      department: input.department,
      runId,
    });
  }
  if (input.status === 'success') scheduleBudgetAlert(scopesFor(input.department, input.role), cols.cost_usd);

  return NextResponse.json({ ok: true, runId, cost_usd: cols.cost_usd });
}
