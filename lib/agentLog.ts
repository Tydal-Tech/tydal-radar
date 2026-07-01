// Shared agent-run logging (Phase 1). Phase 0's runAgent wraps an in-process
// Claude call; Phase 1 adds external runners (Engineering agents in GitHub
// Actions) that report via /api/ops/ingest. Both must write IDENTICAL agent_runs
// rows and fire the SAME budget alerts — so the row math and the alert live here,
// one source of truth, imported by both paths. "One meter, two doors."

import { after } from 'next/server';
import { costOf, type Usage } from './pricing';
import { budgetStatus, thresholdsCrossed } from './agentBudget';
import { sendPush } from './serverPush';

/** The budget scopes a run is checked/charged against (global → dept → role). */
export function scopesFor(department: string, role: string): string[] {
  return ['global', `dept:${department}`, `role:${role}`];
}

/** The token + cost columns for a completed run — identical in-process or external. */
export function runCostColumns(model: string, usage: Usage) {
  return {
    input_tokens: usage.inputTokens ?? 0,
    output_tokens: usage.outputTokens ?? 0,
    cache_read_tokens: usage.cacheReadTokens ?? 0,
    cache_write_tokens: usage.cacheWriteTokens ?? 0,
    cost_usd: costOf(model, usage),
  };
}

// Fire a CEO push when this run's cost pushes a budgeted scope across 80%/100%
// of its cap. The run belongs to every scope we check, so each line's spent
// already includes this run's cost → spentBefore = spent − cost. Best-effort.
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

/** Schedule the threshold push after the response ships (Vercel keeps the fn alive). */
export function scheduleBudgetAlert(scopes: string[], runCost: number): void {
  const work = () => alertOnCrossings(scopes, runCost).catch(() => {});
  try {
    after(work);
  } catch {
    void work(); // outside a request scope (e.g. tests) → just detach it
  }
}
