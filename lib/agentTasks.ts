// The approvals queue (Phase 1) — the slot Phase 0 reserved in /ops. One row per
// thing needing the CEO's attention: a PR awaiting merge, or an agent escalation
// (a going-cold high-value deal, a change touching auth/data it won't make). The
// row-building is pure (tested); the reads/writes are best-effort service-role.

import type { SupabaseClient } from '@supabase/supabase-js';

export type TaskKind = 'pr' | 'escalation';

export interface TaskInput {
  kind: TaskKind;
  title: string;
  detail?: string | null;
  link?: string | null;
  role?: string | null;
  department?: string | null;
  runId?: string | null;
}

/** Pure: normalize a task into the agent_tasks insert row. */
export function taskRow(t: TaskInput) {
  return {
    kind: t.kind,
    title: t.title.slice(0, 300),
    detail: t.detail ? t.detail.slice(0, 2000) : null,
    link: t.link ?? null,
    role: t.role ?? null,
    department: t.department ?? null,
    run_id: t.runId ?? null,
    status: 'pending' as const,
  };
}

/** Raise an approvals-queue item. Best-effort — never throws (observability can't break work). */
export async function raiseTask(db: SupabaseClient, t: TaskInput): Promise<void> {
  try {
    await db.from('agent_tasks').insert(taskRow(t));
  } catch {
    /* table not migrated yet, or transient — the run itself already succeeded */
  }
}

export interface PendingTask {
  id: string;
  kind: TaskKind;
  title: string;
  detail: string | null;
  link: string | null;
  role: string | null;
  department: string | null;
  created_at: string;
}

/** Pending approvals, newest first. Returns [] if the table isn't migrated. */
export async function pendingTasks(db: SupabaseClient, limit = 25): Promise<PendingTask[]> {
  try {
    const { data, error } = await db
      .from('agent_tasks')
      .select('id,kind,title,detail,link,role,department,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as PendingTask[];
  } catch {
    return [];
  }
}
