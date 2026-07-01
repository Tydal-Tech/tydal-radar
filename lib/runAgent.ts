// The instrumentation seam for AI-org agent runs (Phase 0). Every agent call
// flows through here: budget pre-check → run → capture usage → cost → log.
//
// Design principle: observability must never take down the product. Budget and
// logging are best-effort — if the tables aren't migrated yet or the service
// key is missing, the underlying work still runs (fail-open). The ONE
// intentional stop is a real budget cap being hit (BudgetError).

import { after } from 'next/server';
import { serviceClient } from './serverDb';
import { costOf, type Usage } from './pricing';
import { budgetStatus, thresholdsCrossed } from './agentBudget';
import { sendPush } from './serverPush';
import type { SupabaseClient } from '@supabase/supabase-js';

export class BudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetError';
  }
}

export interface AgentRunResult<T> {
  result: T;
  usage: Usage;
  requestId?: string;
}

export interface AgentSpec<T> {
  role: string;
  department: string;
  model: string;
  effort?: string;
  triggeredBy?: 'human' | 'schedule' | 'orchestrator';
  run: () => Promise<AgentRunResult<T>>;
}

function client(): SupabaseClient | null {
  try {
    return serviceClient();
  } catch {
    return null; // no service key (e.g. local dev) → run without logging
  }
}

// Fire a CEO push when this run's cost pushes a budgeted scope across 80%/100%
// of its cap. Runs after the response (Next `after`), so it never adds latency;
// best-effort throughout. Since the run belongs to every scope we check, each
// line's spent already includes this run's cost, so spentBefore = spent − cost.
async function alertOnCrossings(scopes: string[], runCost: number): Promise<void> {
  if (runCost <= 0) return;
  const { lines } = await budgetStatus(scopes);
  let worst: { threshold: number; scope: string; period: string; limit: number; spent: number } | null = null;
  for (const l of lines) {
    for (const t of thresholdsCrossed(l.spent - runCost, l.spent, l.limit)) {
      if (!worst || t > worst.threshold) worst = { threshold: t, scope: l.scope, period: l.period, limit: l.limit, spent: l.spent };
    }
  }
  if (!worst) return;
  const cap = `${worst.period} $${worst.limit.toFixed(2)} cap`;
  const body =
    worst.threshold >= 100
      ? `${worst.scope} hit 100% of the ${cap} — new runs are now blocked.`
      : `${worst.scope} crossed ${worst.threshold}% of the ${cap} ($${worst.spent.toFixed(2)} spent).`;
  await sendPush('Tydal · budget', body);
}

function scheduleAlert(scopes: string[], runCost: number): void {
  const work = () => alertOnCrossings(scopes, runCost).catch(() => {});
  try {
    after(work); // completes after the response ships (Vercel keeps the fn alive)
  } catch {
    void work(); // outside a request scope (e.g. tests) → just detach it
  }
}

export async function runAgent<T>(spec: AgentSpec<T>): Promise<{ result: T; runId: string | null }> {
  const db = client();
  const triggeredBy = spec.triggeredBy ?? 'human';
  const scopes = ['global', `dept:${spec.department}`, `role:${spec.role}`];
  const base = {
    role: spec.role,
    department: spec.department,
    model: spec.model,
    effort: spec.effort ?? null,
    triggered_by: triggeredBy,
  };

  // 1. Budget pre-check — best-effort, but a real cap hit is enforced.
  if (db) {
    try {
      const status = await budgetStatus(scopes);
      if (status.blocked) {
        const w = status.worst;
        await db
          .from('agent_runs')
          .insert({
            ...base,
            status: 'blocked',
            escalated: true,
            error: `budget cap: ${w?.scope} ${w?.period} at ${Math.round(w?.pct ?? 0)}%`,
          })
          .then(undefined, () => {}); // logging the block is best-effort
        throw new BudgetError(`Budget cap reached for ${w?.scope} (${w?.period}).`);
      }
    } catch (e) {
      if (e instanceof BudgetError) throw e;
      console.warn('[runAgent] budget check skipped:', e instanceof Error ? e.message : e);
    }
  }

  // 2. Open the run (best-effort).
  const t0 = Date.now();
  let runId: string | null = null;
  if (db) {
    try {
      const { data } = await db.from('agent_runs').insert({ ...base, status: 'running' }).select('id').single();
      runId = (data as { id: string } | null)?.id ?? null;
    } catch (e) {
      console.warn('[runAgent] could not open run row:', e instanceof Error ? e.message : e);
    }
  }

  // 3 + 4. Run the work; capture usage; close the row (best-effort).
  try {
    const { result, usage, requestId } = await spec.run();
    const cost = costOf(spec.model, usage);
    if (db && runId) {
      await db
        .from('agent_runs')
        .update({
          status: 'success',
          input_tokens: usage.inputTokens ?? 0,
          output_tokens: usage.outputTokens ?? 0,
          cache_read_tokens: usage.cacheReadTokens ?? 0,
          cache_write_tokens: usage.cacheWriteTokens ?? 0,
          cost_usd: cost,
          duration_ms: Date.now() - t0,
          request_id: requestId ?? null,
        })
        .eq('id', runId)
        .then(undefined, () => {});
      // 5. Threshold alert (post-response, best-effort) — see docs §6.
      scheduleAlert(scopes, cost);
    }
    return { result, runId };
  } catch (e) {
    if (db && runId) {
      await db
        .from('agent_runs')
        .update({
          status: 'error',
          duration_ms: Date.now() - t0,
          error: e instanceof Error ? e.message.slice(0, 500) : 'unknown error',
        })
        .eq('id', runId)
        .then(undefined, () => {});
    }
    throw e;
  }
}
