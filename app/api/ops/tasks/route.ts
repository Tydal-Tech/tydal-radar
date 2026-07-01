import { NextResponse } from 'next/server';
import { hasValidSession, serviceClient } from '@/lib/serverDb';

// Resolve an approvals-queue item from the cockpit (Phase 1). Browser-gated
// (app-password session), service-role. This only flips agent_tasks.status to
// clear the lane — the actual approval (merging a PR) still happens in GitHub.
export const runtime = 'nodejs';

const ALLOWED = ['done', 'rejected'];

export async function POST(req: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let id: string, status: string;
  try {
    const body = (await req.json()) as { id?: string; status?: string };
    id = String(body.id ?? '');
    status = String(body.status ?? '');
    if (!id || !ALLOWED.includes(status)) throw new Error('bad request');
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  try {
    const db = serviceClient();
    const { error } = await db
      .from('agent_tasks')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}
