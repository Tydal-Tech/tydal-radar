# Phase 0 — Observability & Budgets (the CFO layer)

> **Spec for the first build of the AI org** (see `docs/ai-org.md` §11). Before
> any agent is "hired," we install the layer that lets the CEO **see every run
> and cap every dollar**. You cannot command an org you can't see or stop.
>
> Scope of Phase 0: *visibility + spend control* over agent runs. **Out of
> scope** (later phases): the approvals queue, scheduling, the departments
> themselves. Status: **spec** — not built yet.

## 1. Goal

Every AI action in Tydal flows through one instrumented seam that:
1. **Checks the budget** before it runs (and refuses if over cap).
2. **Runs** the work and captures token usage.
3. **Computes cost** and **logs the run** (who/what/model/tokens/$/duration/result).
4. **Alerts** the CEO when spend crosses a threshold.

Plus a **cockpit** (a gated dashboard) that shows spend vs budget, live/recent
runs, failures, and top spenders.

The app already has the substrate this reuses: service-role server routes
(`lib/serverDb.ts`), the password gate (`proxy.ts`), and Web Push (VAPID +
`push_subscriptions`). Phase 0 adds two tables, three pure libs, one wrapper,
one read route, and one page.

---

## 2. Data model (two new tables)

Both tables follow the locked-down pattern (RLS on, **no anon policies** →
service-role only; the app reads them through a gated route). Run this in
**Supabase → SQL Editor** (schema + RLS is a human step):

```sql
-- One row per agent run.
create table if not exists public.agent_runs (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  role               text not null,                 -- e.g. 'pitch-writer'
  department         text not null,                 -- e.g. 'revenue'
  model              text not null,
  effort             text,
  status             text not null default 'running', -- running|success|error|blocked
  triggered_by       text not null default 'human',   -- human|schedule|orchestrator
  input_tokens       int  not null default 0,
  output_tokens      int  not null default 0,
  cache_read_tokens  int  not null default 0,
  cache_write_tokens int  not null default 0,
  cost_usd           numeric(12,6) not null default 0,
  duration_ms        int,
  request_id         text,                          -- Anthropic request id
  error              text,
  escalated          boolean not null default false,
  meta               jsonb
);
create index if not exists agent_runs_created_idx on public.agent_runs (created_at desc);
create index if not exists agent_runs_dept_idx    on public.agent_runs (department, created_at desc);
create index if not exists agent_runs_role_idx    on public.agent_runs (role, created_at desc);
alter table public.agent_runs enable row level security;   -- no policies → anon fully denied

-- Spend caps by scope + period.
create table if not exists public.agent_budgets (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null,           -- 'global' | 'dept:<name>' | 'role:<name>'
  period     text not null,           -- 'day' | 'week' | 'month'
  limit_usd  numeric(12,2) not null,
  updated_at timestamptz not null default now(),
  unique (scope, period)
);
alter table public.agent_budgets enable row level security; -- no policies → anon fully denied

-- Seed sane starting caps (edit anytime):
insert into public.agent_budgets (scope, period, limit_usd) values
  ('global','day', 5.00),
  ('global','month', 75.00)
on conflict (scope, period) do nothing;
```

> Service-role (server routes) bypasses RLS, so the wrapper writes and the
> cockpit reads work; the public anon key gets nothing — same posture as
> `prospects`/`pipeline`.

---

## 3. Pricing module — `lib/pricing.ts` (pure, tested)

Single source of truth for cost. $ per 1M tokens; cache reads bill ~0.1×, cache
writes ~1.25× of the input rate.

```ts
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

// $/1M tokens. Update Sonnet 5 to 3/15 after the 2026-08-31 intro period.
const RATES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-5':  { in: 2, out: 10 },
  'claude-opus-4-8':  { in: 5, out: 25 },
};

export function costOf(model: string, u: Usage): number {
  const r = RATES[model] ?? RATES['claude-sonnet-5'];
  const input      = (u.inputTokens ?? 0) * r.in;
  const cacheRead  = (u.cacheReadTokens ?? 0) * r.in * 0.1;
  const cacheWrite = (u.cacheWriteTokens ?? 0) * r.in * 1.25;
  const output     = (u.outputTokens ?? 0) * r.out;
  return (input + cacheRead + cacheWrite + output) / 1_000_000;
}
```

Cost is computed **on write** and stored on the row, so historical spend is
fixed even when rates change.

---

## 4. The instrumentation seam — `lib/runAgent.ts` (server-only)

Every agent call goes through this. It's the choke point (like `db.ts` for data).

```ts
import { serviceClient } from './serverDb';
import { costOf, type Usage } from './pricing';
import { budgetStatus } from './agentBudget';

export class BudgetError extends Error {}

export async function runAgent<T>(spec: {
  role: string;
  department: string;
  model: string;
  effort?: string;
  triggeredBy?: 'human' | 'schedule' | 'orchestrator';
  run: () => Promise<{ result: T; usage: Usage; requestId?: string }>;
}): Promise<{ result: T; runId: string }> {
  const db = serviceClient();

  // 1. Budget pre-check across applicable scopes.
  const scopes = ['global', `dept:${spec.department}`, `role:${spec.role}`];
  const status = await budgetStatus(scopes);
  if (status.blocked) {
    await db.from('agent_runs').insert({
      role: spec.role, department: spec.department, model: spec.model,
      effort: spec.effort, status: 'blocked', escalated: true,
      triggered_by: spec.triggeredBy ?? 'human',
      error: `budget cap: ${status.worst?.scope} ${status.worst?.period}`,
    });
    throw new BudgetError(`Budget cap reached for ${status.worst?.scope}`);
  }

  // 2. Open the run.
  const t0 = Date.now();
  const { data: row } = await db.from('agent_runs').insert({
    role: spec.role, department: spec.department, model: spec.model,
    effort: spec.effort, status: 'running', triggered_by: spec.triggeredBy ?? 'human',
  }).select('id').single();
  const runId = row!.id as string;

  // 3. Run + capture usage; 4. compute cost + close the row.
  try {
    const { result, usage, requestId } = await spec.run();
    await db.from('agent_runs').update({
      status: 'success',
      input_tokens: usage.inputTokens, output_tokens: usage.outputTokens,
      cache_read_tokens: usage.cacheReadTokens ?? 0,
      cache_write_tokens: usage.cacheWriteTokens ?? 0,
      cost_usd: costOf(spec.model, usage),
      duration_ms: Date.now() - t0, request_id: requestId,
    }).eq('id', runId);
    // 5. threshold alert (fire-and-forget) — see §6.
    return { result, runId };
  } catch (e) {
    await db.from('agent_runs').update({
      status: 'error', duration_ms: Date.now() - t0,
      error: e instanceof Error ? e.message.slice(0, 500) : 'unknown',
    }).eq('id', runId);
    throw e;
  }
}
```

**First customer — retrofit `/api/ai/pitch`.** Wrap its Claude call:

```ts
const { result } = await runAgent({
  role: 'pitch-writer', department: 'revenue', model: MODEL,
  run: async () => {
    const resp = await fetch('https://api.anthropic.com/v1/messages', { ... });
    const data = await resp.json();
    const u = data.usage;
    return {
      result: parsePitch(text),
      usage: {
        inputTokens: u.input_tokens, outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens,
        cacheWriteTokens: u.cache_creation_input_tokens,
      },
      requestId: data.id,
    };
  },
});
```

Now every pitch is logged with real cost — the org has its first instrumented
employee.

---

## 5. Budgets — `lib/agentBudget.ts`

```ts
import { serviceClient } from './serverDb';

// UTC period start. (Swap to America/Toronto if you want local-day caps.)
export function periodStart(period: 'day'|'week'|'month', now = new Date()): Date { /* ... */ }

// Sum cost_usd for a scope over its period. scope 'global' = all rows;
// 'dept:x' filters department; 'role:x' filters role.
export async function periodSpend(scope: string, period: 'day'|'week'|'month'): Promise<number> { /* ... */ }

// Check every scope×period that has a budget row; blocked if any is at/over cap.
export async function budgetStatus(scopes: string[]): Promise<{
  blocked: boolean;
  worst?: { scope: string; period: string; spent: number; limit: number; pct: number };
  lines: { scope: string; period: string; spent: number; limit: number; pct: number }[];
}> { /* ... */ }
```

- **Pre-run cap (org level):** `budgetStatus` blocks *spawning* once a scope has
  spent ≥ its cap. Simple and conservative — no run starts if we're tapped out.
- **Per-run cap (single agent):** bound one run's max cost with Anthropic
  `max_tokens` / `task_budget` in each agent's own call. Global cap stops the
  swarm; per-run cap stops any one agent running away.
- Scopes are hierarchical: a run is blocked if **global**, **its department**,
  or **its role** cap is hit.

Pure period/aggregation math is **unit-tested** with fixture rows.

---

## 6. Alerts (reuse Web Push)

After a run logs, check each budgeted scope's spend %. On crossing **80%** and
**100%** of a cap (once per period, tracked via a `meta` marker or a tiny
`agent_alerts` row), send a push through the existing VAPID + `push_subscriptions`
pipeline: *"Revenue dept at 100% of today's $5 cap — runs blocked."* Blocked
runs (§4) always push. Keep it throttled so one busy hour doesn't spam.

---

## 7. The cockpit — dashboard + summary route

**`GET /api/ops/summary`** (gated by `proxy.ts`; service-role): returns
```jsonc
{
  "spend": { "global": { "day": 1.42, "week": 6.10, "month": 22.5 } },
  "byDepartment": [{ "department": "revenue", "month": 18.0 }, ...],
  "byRole":       [{ "role": "pitch-writer", "month": 15.2 }, ...],
  "budgets":      [{ "scope": "global", "period": "day", "spent": 1.42, "limit": 5, "pct": 28 }, ...],
  "running":      [{ "id", "role", "started_at" }],
  "recent":       [{ "id", "role", "model", "status", "cost_usd", "duration_ms", "created_at" }],
  "errors":       [/* last N status=error */]
}
```

**Dashboard page** (gated; a new `/ops` route or a card in the Stats sheet):
- **Budget bars** — spend vs cap for global/day, global/month, and each
  department (green → amber ≥80% → red ≥100%).
- **Live** — agents running now.
- **Recent runs** — table: role · model · status · $ · duration · time.
- **Errors** — the exception feed.
- **Top spenders** — roles/departments by month-to-date cost.

Reads only; renders the summary. (An **approvals queue** — things needing your
yes — is Phase 1; leave a slot for it here.)

---

## 8. Security

`agent_runs` + `agent_budgets` are created RLS-on with **no anon policies** →
the public key can't touch them; the wrapper (service-role) writes, the summary
route (service-role, password-gated) reads. Same posture as the Phase-2 data
lockdown. Never log secrets into `meta`/`error` (per `AGENTS.md`).

---

## 9. Verification & testing

- **Unit:** `costOf` (rates, cache math), `periodStart`/`periodSpend`,
  `budgetStatus` (block boundaries) — pure, fixture-driven.
- **Route:** curl `/api/ai/pitch` → confirm an `agent_runs` row with real cost;
  curl `/api/ops/summary` → confirm aggregation. (Local test uses the service
  key; block path testable by seeding a tiny budget row.)
- **Gates:** every commit passes `tsc` + `npm test` + `npm run build` (CI now
  enforces this). Do the build on a **branch → PR → preview → merge** (CI +
  Vercel preview exist now — first real use of the agent-ready workflow).

## 10. Build checklist (in order)

- [ ] Run the §2 migration in Supabase (tables + RLS + seed caps). *(human)*
- [ ] `lib/pricing.ts` + tests.
- [ ] `lib/agentBudget.ts` (periodStart / periodSpend / budgetStatus) + tests.
- [ ] `lib/runAgent.ts` wrapper.
- [ ] Retrofit `app/api/ai/pitch/route.ts` to run through `runAgent`.
- [ ] `app/api/ops/summary/route.ts` (gated, service-role).
- [ ] `/ops` dashboard page (budget bars · live · recent · errors · top spenders).
- [ ] Threshold push alerts (reuse VAPID). *(can ship last)*
- [ ] Log to `CHANGELOG.md` + `TYDAL_PROGRESS.md`.

## 11. Cost of Phase 0 itself

**Negligible.** It wraps existing Claude calls (no extra model spend), adds a
couple of DB writes per run, and one dashboard read. Infra is free-tier. What it
*buys* is the ability to safely spend on everything after it.

---

**Once Phase 0 ships, the org has eyes and a wallet with a limit.** Then Phase 1
(Engineering PRs + Revenue pitch/pipeline) can hire its first real staff, and
every one of them reports its cost into this layer from day one.
