import { NextResponse } from 'next/server';
import { hasValidSession, serviceClient } from '@/lib/serverDb';
import { periodSpend, periodStart, type Period } from '@/lib/agentBudget';

// The CEO cockpit's data source (Phase 0). Gated + service-role. Aggregates
// agent_runs + agent_budgets into spend, budgets, live/recent runs, and errors.
// Resilient: returns an empty cockpit (not a 500) if the tables aren't migrated.
export const runtime = 'nodejs';

interface RunRow {
  id: string;
  role: string;
  department: string;
  model: string;
  status: string;
  cost_usd: number;
  duration_ms: number | null;
  created_at: string;
}

const EMPTY = {
  spend: { global: { day: 0, week: 0, month: 0 } },
  budgets: [] as unknown[],
  byDepartment: [] as unknown[],
  byRole: [] as unknown[],
  running: [] as unknown[],
  recent: [] as unknown[],
  errors: [] as unknown[],
  configured: false,
};

export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const db = serviceClient();

    const [day, week, monthRunsRes, recentRes, errorsRes, budgetRes] = await Promise.all([
      periodSpend('global', 'day'),
      periodSpend('global', 'week'),
      db.from('agent_runs').select('department,role,cost_usd').gte('created_at', periodStart('month').toISOString()),
      db
        .from('agent_runs')
        .select('id,role,department,model,status,cost_usd,duration_ms,created_at')
        .order('created_at', { ascending: false })
        .limit(25),
      db
        .from('agent_runs')
        .select('id,role,model,error,created_at')
        .eq('status', 'error')
        .order('created_at', { ascending: false })
        .limit(10),
      db.from('agent_budgets').select('scope,period,limit_usd'),
    ]);

    const monthRows = (monthRunsRes.data ?? []) as { department: string; role: string; cost_usd: number }[];
    const byDeptMap = new Map<string, number>();
    const byRoleMap = new Map<string, number>();
    let month = 0;
    for (const r of monthRows) {
      const c = Number(r.cost_usd ?? 0);
      month += c;
      byDeptMap.set(r.department, (byDeptMap.get(r.department) ?? 0) + c);
      byRoleMap.set(r.role, (byRoleMap.get(r.role) ?? 0) + c);
    }

    const budgetRows = (budgetRes.data ?? []) as { scope: string; period: Period; limit_usd: number }[];
    const budgets = await Promise.all(
      budgetRows.map(async (b) => {
        const spent = await periodSpend(b.scope, b.period);
        const limit = Number(b.limit_usd);
        return { scope: b.scope, period: b.period, spent, limit, pct: limit > 0 ? (spent / limit) * 100 : 0 };
      }),
    );

    const recent = (recentRes.data ?? []) as RunRow[];

    return NextResponse.json({
      spend: { global: { day, week, month } },
      budgets: budgets.sort((a, b) => b.pct - a.pct),
      byDepartment: [...byDeptMap].map(([department, m]) => ({ department, month: m })).sort((a, b) => b.month - a.month),
      byRole: [...byRoleMap].map(([role, m]) => ({ role, month: m })).sort((a, b) => b.month - a.month),
      running: recent.filter((r) => r.status === 'running'),
      recent,
      errors: errorsRes.data ?? [],
      configured: true,
    });
  } catch {
    // Tables not migrated yet, or no service key → show an empty cockpit.
    return NextResponse.json(EMPTY);
  }
}
