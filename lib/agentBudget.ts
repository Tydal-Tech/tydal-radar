// Budget enforcement for AI-org agent runs (Phase 0). Scopes are hierarchical:
// a run is blocked if its global, department, or role cap is hit, for any
// period that has a budget row. The pure decision logic (periodStart,
// evaluateBudgets) is unit-tested; periodSpend/budgetStatus do the DB reads.

import { serviceClient } from './serverDb';

export type Period = 'day' | 'week' | 'month';

export interface BudgetLine {
  scope: string;
  period: Period;
  spent: number;
  limit: number;
  pct: number; // 0..∞ (percentage of cap)
}

/** UTC start of the given period. (Switch to a TZ-aware start if you want local-day caps.) */
export function periodStart(period: Period, now: Date = new Date()): Date {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'day') return day;
  if (period === 'month') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // week: back up to the most recent Monday.
  const back = (day.getUTCDay() + 6) % 7; // 0=Mon..6=Sun → days since Monday
  return new Date(day.getTime() - back * 86_400_000);
}

/** Spend %s that trigger a CEO alert. */
export const ALERT_THRESHOLDS = [80, 100] as const;

/**
 * Pure: which alert thresholds did this run's cost push the scope *across*?
 * Fires only on the transition (spentBefore below the mark, spentAfter at/over
 * it), so each threshold alerts exactly once per period — no dedup state needed.
 */
export function thresholdsCrossed(
  spentBefore: number,
  spentAfter: number,
  limit: number,
  thresholds: readonly number[] = ALERT_THRESHOLDS,
): number[] {
  if (limit <= 0) return [];
  return thresholds.filter((t) => {
    const mark = (t / 100) * limit;
    return spentBefore < mark && spentAfter >= mark;
  });
}

/** Pure: turn budget rows + a spend lookup into lines, and decide blocked. */
export function evaluateBudgets(
  rows: { scope: string; period: Period; limit_usd: number }[],
  spend: (scope: string, period: Period) => number,
): { blocked: boolean; worst?: BudgetLine; lines: BudgetLine[] } {
  const lines: BudgetLine[] = rows.map((r) => {
    const spent = spend(r.scope, r.period);
    const pct = r.limit_usd > 0 ? (spent / r.limit_usd) * 100 : 0;
    return { scope: r.scope, period: r.period, spent, limit: r.limit_usd, pct };
  });
  const blocked = lines.some((l) => l.pct >= 100);
  const worst = [...lines].sort((a, b) => b.pct - a.pct)[0];
  return { blocked, worst, lines };
}

/** Total $ spent for a scope over its period (service-role read). */
export async function periodSpend(scope: string, period: Period): Promise<number> {
  const db = serviceClient();
  let q = db
    .from('agent_runs')
    .select('cost_usd')
    .gte('created_at', periodStart(period).toISOString());
  if (scope.startsWith('dept:')) q = q.eq('department', scope.slice(5));
  else if (scope.startsWith('role:')) q = q.eq('role', scope.slice(5));
  // 'global' → no filter
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).reduce((s, r) => s + Number((r as { cost_usd: number }).cost_usd ?? 0), 0);
}

/** Are any of these scopes' caps hit? (service-role reads) */
export async function budgetStatus(scopes: string[]) {
  const db = serviceClient();
  const { data, error } = await db
    .from('agent_budgets')
    .select('scope,period,limit_usd')
    .in('scope', scopes);
  if (error) throw error;
  const rows = (data ?? []) as { scope: string; period: Period; limit_usd: number }[];
  const spends = new Map<string, number>();
  await Promise.all(
    rows.map(async (r) => spends.set(`${r.scope}|${r.period}`, await periodSpend(r.scope, r.period))),
  );
  return evaluateBudgets(rows, (s, p) => spends.get(`${s}|${p}`) ?? 0);
}
