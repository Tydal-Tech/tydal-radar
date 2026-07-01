// Validation for POST /api/ops/ingest — how an external agent (an Engineering
// run in GitHub Actions) reports a completed run into the same agent_runs table
// the in-process seam writes. Pure + tested so the route stays thin.

import type { Usage } from './pricing';
import type { TaskKind } from './agentTasks';

export type RunStatus = 'success' | 'error' | 'blocked';
const STATUSES: RunStatus[] = ['success', 'error', 'blocked'];
const TRIGGERS = ['human', 'schedule', 'orchestrator'] as const;
type Trigger = (typeof TRIGGERS)[number];

export interface IngestInput {
  role: string;
  department: string;
  model: string;
  effort: string | null;
  triggeredBy: Trigger;
  status: RunStatus;
  usage: Usage;
  requestId: string | null;
  durationMs: number | null;
  error: string | null;
  escalated: boolean;
  meta: Record<string, unknown> | null;
  task: { kind: TaskKind; title: string; detail?: string | null; link?: string | null } | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Parse + validate an ingest body. Throws Error('…') on anything the route must reject (→ 400). */
export function parseIngest(raw: unknown): IngestInput {
  if (!raw || typeof raw !== 'object') throw new Error('body must be an object');
  const b = raw as Record<string, unknown>;

  const role = str(b.role);
  const department = str(b.department);
  const model = str(b.model);
  if (!role || !department || !model) throw new Error('role, department and model are required');

  const status = STATUSES.includes(b.status as RunStatus) ? (b.status as RunStatus) : 'success';
  const triggeredBy = (TRIGGERS as readonly string[]).includes(str(b.triggered_by))
    ? (str(b.triggered_by) as Trigger)
    : 'schedule';

  const u = (b.usage ?? {}) as Record<string, unknown>;
  const usage: Usage = {
    inputTokens: num(u.inputTokens),
    outputTokens: num(u.outputTokens),
    cacheReadTokens: num(u.cacheReadTokens),
    cacheWriteTokens: num(u.cacheWriteTokens),
  };

  let task: IngestInput['task'] = null;
  if (b.task && typeof b.task === 'object') {
    const t = b.task as Record<string, unknown>;
    const kind = str(t.kind);
    const title = str(t.title);
    if ((kind === 'pr' || kind === 'escalation') && title) {
      task = { kind, title, detail: str(t.detail) || null, link: str(t.link) || null };
    }
  }

  return {
    role,
    department,
    model,
    effort: str(b.effort) || null,
    triggeredBy,
    status,
    usage,
    requestId: str(b.request_id) || null,
    durationMs: typeof b.duration_ms === 'number' && b.duration_ms >= 0 ? b.duration_ms : null,
    // Never trust an external caller to dump a full diff / secret here — cap it.
    error: str(b.error) ? str(b.error).slice(0, 500) : null,
    escalated: b.escalated === true || task?.kind === 'escalation',
    meta: b.meta && typeof b.meta === 'object' ? (b.meta as Record<string, unknown>) : null,
    task,
  };
}
