// The instrumentation seam for in-process AI-org agent runs (Phase 0). Every
// in-app agent call flows through here: budget pre-check → run → capture usage →
// cost → log. External runners (Engineering agents in GitHub Actions) don't go
// through this — they report via /api/ops/ingest — but both share the row math
// and alerts in lib/agentLog.ts, so they write identical agent_runs rows.
//
// Design principle: observability must never take down the product. Budget and
// logging are best-effort — if the tables aren't migrated yet or the service
// key is missing, the underlying work still runs (fail-open). The ONE
// intentional stop is a real budget cap being hit (BudgetError).

import { serviceClient } from './serverDb';
import { type Usage } from './pricing';
import { budgetStatus } from './agentBudget';
import { scopesFor, runCostColumns, scheduleBudgetAlert } from './agentLog';
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

export async function runAgent<T>(spec: AgentSpec<T>): Promise<{ result: T; runId: string | null }> {
  const db = client();
  const triggeredBy = spec.triggeredBy ?? 'human';
  const scopes = scopesFor(spec.department, spec.role);
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
    const cols = runCostColumns(spec.model, usage);
    if (db && runId) {
      await db
        .from('agent_runs')
        .update({
          status: 'success',
          ...cols,
          duration_ms: Date.now() - t0,
          request_id: requestId ?? null,
        })
        .eq('id', runId)
        .then(undefined, () => {});
      // 5. Threshold alert (post-response, best-effort) — see docs §6.
      scheduleBudgetAlert(scopes, cols.cost_usd);
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
