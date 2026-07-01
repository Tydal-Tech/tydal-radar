# Phase 1 — Engineering + Revenue (the first hires)

> **Spec for the org's first real staff** (see `docs/ai-org.md` §3, §11). Phase 0
> gave the org eyes and a wallet; Phase 1 hires the first four agents whose
> substrate already exists today: two **Engineering** roles that turn work into
> pull requests you merge, and two **Revenue** roles that keep the pipeline warm
> and every door pre-pitched.
>
> **In scope:** Maintenance Engineer, Feature Engineer (PR → *you* merge); Pitch
> Writer, Pipeline Steward (drafts + logs only). **Out of scope** (later phases):
> Market Intelligence (Phase 2), Pricing/Bids (Phase 3), the Chief-of-Staff
> orchestrator (Phase 4), and **any outward message** (Outreach/Proposal writers
> are gated to *always* escalate — not hired here). Status: **spec** — not built.

## 0. Why these four first

They're the lowest-risk, highest-value hires because **the Office is already
built**: the repo + CI gate (`.github/workflows/ci.yml`) + Vercel preview + the
locked-down DB (`lib/serverDb.ts`, gated routes) + the pitch engine (`lib/aiPitch.ts`,
`/api/ai/pitch`) + the pipeline/staleness logic (`lib/staleness.ts`, `FollowUps`).
Every Phase 1 agent produces something you *review before it counts* — a PR you
merge, a pitch you read at the door, a next-actions list you act on. Nothing
deploys, spends, or leaves the building without your yes (`ai-org.md` §10).

---

## 1. Prerequisites (must be true before building)

- **Phase 0 is live** — the `agent_runs` + `agent_budgets` migration has run and
  `/ops` shows real rows. Phase 1 is worthless without the meter (`ai-org.md` §6, CFO).
- **`ANTHROPIC_API_KEY`** exists as a **GitHub Actions repo secret** (not only in
  Vercel), because Engineering agents run in Actions, not in the app.
- **An ops ingest token** — a new `OPS_INGEST_SECRET` (like `CRON_SECRET`) so
  external runners can authenticate to the cost-logging endpoints (§3).

---

## 2. Two execution substrates

Phase 0's `runAgent()` wraps a **single in-process Claude call**. Phase 1 adds a
second kind of worker that runs **outside** the app, so we generalize the seam
rather than fork it.

| Substrate | Who runs here | How it reports cost |
|---|---|---|
| **In-process** (Vercel route / cron) | Revenue: Pitch Writer, Pipeline Steward | `runAgent()` directly — unchanged from Phase 0. |
| **External** (GitHub Actions + Claude Code) | Engineering: Maintenance, Feature | budget **pre-check** then **ingest** via two new ops endpoints (§3), which reuse `costOf` + the same tables. |

Both write the **same `agent_runs` rows** and obey the **same `agent_budgets`
caps**, so `/ops` shows the whole org in one place regardless of where a run
executed. This is the core design rule: *one meter, two doors into it.*

---

## 3. Ops endpoints — extend the Phase 0 seam to external runners

Two thin, gated, service-role routes (mirror `/api/ops/summary`). Authenticated
by `OPS_INGEST_SECRET` (Bearer), **not** the app password (no browser session in
Actions). Never accept the anon key.

**`GET /api/ops/precheck?department=engineering&role=feature-engineer`**
→ `{ blocked: boolean, worst?: {scope,period,pct} }`. Thin wrapper over
`budgetStatus(['global', 'dept:…', 'role:…'])` (`lib/agentBudget.ts`). An external
agent calls this *first* and aborts (logging a `blocked` row) if `blocked`.

**`POST /api/ops/ingest`** — body:
```jsonc
{
  "role": "feature-engineer", "department": "engineering",
  "model": "claude-sonnet-5", "effort": "high",
  "triggered_by": "human",            // 'schedule' for the nightly maintenance run
  "status": "success",                // success|error|blocked
  "usage": { "inputTokens": 0, "outputTokens": 0, "cacheReadTokens": 0, "cacheWriteTokens": 0 },
  "request_id": "…", "duration_ms": 0,
  "meta": { "pr": 42, "reported_cost_usd": 0.31 }  // Claude Code's own total, for reconciliation
}
```
The route computes `cost_usd = costOf(model, usage)` (same source of truth) and
inserts one `agent_runs` row. It also fires the Phase 0 threshold push (§6 of the
Phase 0 doc) on the same crossing logic. **Never** log secrets or full diffs into
`meta`/`error` (`AGENTS.md`).

> Refactor note: extract the row-insert + cost + alert tail of `lib/runAgent.ts`
> into a shared `logRun(spec, usage, status)` so both `runAgent` (in-process) and
> `/api/ops/ingest` (external) call the *same* function — no drift.

---

## 4. Data model — the approvals queue (the slot Phase 0 left)

Phase 0's `/ops` doc reserved a slot for "an approvals queue — things needing
your yes." Phase 1 fills it with one small table (RLS-locked, service-role only,
same posture as `agent_runs`):

```sql
create table if not exists public.agent_tasks (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null,             -- 'pr' | 'escalation'
  title       text not null,
  detail      text,
  link        text,                       -- PR url / prospect id / deep link
  role        text,                       -- which agent raised it
  department  text,
  status      text not null default 'pending', -- pending|approved|rejected|done
  run_id      uuid references public.agent_runs(id),
  resolved_at timestamptz
);
create index if not exists agent_tasks_status_idx on public.agent_tasks (status, created_at desc);
alter table public.agent_tasks enable row level security;  -- no anon policies
```

Phase 1 producers: an Engineering PR opens a `kind='pr'` task; any agent
escalation (`ai-org.md` role "escalates when…") opens a `kind='escalation'` task.
You resolve them from `/ops` (approve/reject just flips `status` — merging still
happens in GitHub; this is the *worklist*, not the merge button).

---

## 5. Role catalog — Phase 1's four hires

Each follows the `ai-org.md` §3 contract: **Model · Trigger · Inputs → Outputs ·
Escalates when · Approval gate.** Budgets by scope in §7.

### 🛠 Engineering (external — GitHub Actions + Claude Code, opens PRs)

**Maintenance Engineer** · Haiku, low · **scheduled** (weekly `workflow`).
- In → repo state. Out → a PR with dependency bumps, lint/test fixes, tiny
  cleanups, **only after `tsc` + `npm test` + `npm run build` pass** in the run.
- Escalates (does **not** touch, opens an `escalation` task instead): anything in
  auth, data access, payments, or secrets.
- Approval gate: **you merge.** It never pushes to `main`.

**Feature Engineer** · Sonnet 5, high · **on-demand** (`workflow_dispatch` or an
issue labeled `agent:feature`).
- In → one feature spec. Out → a branch → CI green → Vercel preview → a PR, self-verified.
- Escalates (opens a draft PR + `escalation` task, doesn't finish): schema
  changes, new external deps, anything user-facing it can't self-verify.
- Approval gate: **you merge** after eyeballing the preview.

Both obey `AGENTS.md` verbatim (branch not `main`, secrets rules, the three
gates). Per-run cost is bounded by a **max-turns cap** in the Action config
(`ai-org.md` §5 per-run cap) plus the `role:` budget in §7.

### 📣 Revenue (in-process — Vercel route/cron via `runAgent`)

**Pitch Writer** · Haiku→Sonnet · **on-demand, high fan-out** (1 per prospect).
- Already exists as `/api/ai/pitch`. Phase 1 adds **batch pre-drafting**: a route
  that takes the day's route (from "Plan my walk") and drafts + caches a pitch per
  stop, each call through `runAgent` (role `pitch-writer`, dept `revenue`),
  reusing the per-prospect `localStorage` cache. Haiku by default; Sonnet on
  demand. Escalates: never (you review at the door).
- Approval gate: none needed — output is a draft you read, never sent.

**Pipeline Steward** · Haiku, low · **scheduled** (daily cron, alongside
`notify-followups`).
- In → pipeline state. Out → a prioritized next-actions digest (stale/going-cold
  deals from `lib/staleness.ts`, follow-ups due) + a push, through `runAgent`.
- Escalates: a going-cold **high-value** deal (underwriting band `$$$`) → an
  `escalation` task + push.
- Approval gate: none — it logs and alerts; it does not message prospects.

> **Not hired in Phase 1:** Outreach Drafter, Proposal Writer, QA Engineer,
> Reliability Monitor. The first two are outward (always your send) → later; the
> last two are cheap Phase-1.5 add-ons once the two engineers prove out.

---

## 6. Runners — the GitHub Actions workflows (the Office)

- **`.github/workflows/agent-maintenance.yml`** — `on: schedule` (weekly) +
  `workflow_dispatch`. Steps: checkout → `GET /api/ops/precheck` (abort if
  blocked) → run Claude Code headless with the Maintenance brief and
  `ANTHROPIC_API_KEY` → if it produced a green branch, open a PR via the API →
  `POST /api/ops/ingest` with the run's usage (parsed from Claude Code's
  `--output-format json`: `usage`, `total_cost_usd`, `session_id`).
- **`.github/workflows/agent-feature.yml`** — `on: workflow_dispatch` (inputs:
  `spec`) + `issues` labeled `agent:feature`. Same shape, Sonnet, the Feature brief.

Role **briefs** live in `docs/agents/` (Company Wiki, `ai-org.md` §6) and are
passed as the system/append prompt; they inherit `AGENTS.md`. Keep briefs cached
(stable prefix) so repeat runs bill at ~10% (`ai-org.md` §5).

---

## 7. Budgets to seed (on top of Phase 0's global $5/day · $75/mo)

```sql
insert into public.agent_budgets (scope, period, limit_usd) values
  ('dept:engineering','day',  2.00), ('dept:engineering','month', 30.00),
  ('dept:revenue','day',      1.00), ('dept:revenue','month',     15.00),
  ('role:feature-engineer','day', 1.00),
  ('role:maintenance-engineer','day', 0.50)
on conflict (scope, period) do nothing;
```

Global cap still backstops everything. Per-run caps (max-turns / `max_tokens`)
stop any single agent running away; these scope caps stop the *swarm*.

---

## 8. Cockpit additions — `/ops` grows an approvals lane

- **Approvals** — `agent_tasks` where `status='pending'`, newest first: PRs
  awaiting merge + escalations awaiting a call, each a tappable link, with
  approve/reject (flips `status`). This is the Phase-0-reserved slot.
- Recent-runs table now naturally shows both substrates (Engineering rows appear
  via ingest). Add a `department` column and a `triggered_by` chip
  (human/schedule) so you can tell a nightly job from a hand-kicked one.
- Summary route (`/api/ops/summary`) gains a `pending: agent_tasks[]` field.

---

## 9. Guardrails mapping (`ai-org.md` §10)

- **Deploy to prod** — only via *your* merge to `main`; no agent pushes to `main`
  (enforced by `AGENTS.md` + branch protection).
- **Outbound messages** — none exist in Phase 1 by construction.
- **Spend/billing, contracts, new scheduled agents** — the maintenance cron and
  ingest token are stood up *by you* in this build; agents don't create schedules.
- **Auth/data/payments changes** — Maintenance escalates instead of touching;
  Feature escalates schema changes. Both ride CI's existing gate before any merge.
- **Secrets** — briefs and `meta`/`error` never carry key/token/diff bodies.

---

## 10. Verification & testing

- **Unit:** `precheck`/`ingest` cost math (a known `usage` → the `costOf` value),
  `blocked` → the pre-check refuses, auth-required (401 without the token).
- **Shared `logRun`:** the refactor keeps `runAgent`'s existing behavior — Phase 0
  tests stay green; add a test that ingest and runAgent produce identical rows for
  identical input.
- **Dry run:** trigger `agent-maintenance.yml` on a throwaway branch; confirm (a)
  an `agent_runs` row with real cost, (b) a PR, (c) an `agent_tasks` `pr` row, (d)
  `/ops` shows all three. Seed a tiny `role:maintenance-engineer` cap to test the
  block path.
- **Gates:** every commit passes `tsc` + `npm test` + `npm run build` (CI); ship
  each piece **branch → PR → CI → preview → merge**.

---

## 11. Build checklist (in order)

- [ ] Add `OPS_INGEST_SECRET` (Vercel + Actions) and `ANTHROPIC_API_KEY` (Actions). *(human)*
- [ ] Run the `agent_tasks` migration (§4, RLS-locked). *(human)*
- [ ] Refactor `lib/runAgent.ts` → extract shared `logRun()` (row + cost + alert).
- [ ] `GET /api/ops/precheck` + `POST /api/ops/ingest` (token-gated, service-role) + tests.
- [ ] `agent_tasks` writes (PR opened / escalation) + `pending` in `/api/ops/summary`.
- [ ] `/ops` approvals lane + department/trigger columns.
- [ ] `docs/agents/maintenance.md` + `docs/agents/feature.md` role briefs.
- [ ] `.github/workflows/agent-maintenance.yml` (scheduled) + `agent-feature.yml` (dispatch).
- [ ] Revenue: batch pre-draft route for Pitch Writer; daily Pipeline Steward cron.
- [ ] Seed §7 budgets. *(human)*
- [ ] Log to `CHANGELOG.md` + `TYDAL_PROGRESS.md`.

---

## 12. Cost

Low and bounded. Engineering: a weekly Haiku maintenance pass ≈ pennies; a Sonnet
feature run ≈ $0.20–1 (`ai-org.md` §2), both capped at §7. Revenue: a pitch ≈
**1.5¢** Sonnet / **<1¢** Haiku (`ai-org.md` §8); a daily Haiku steward digest ≈
pennies. This is the **Lean tier** (~$10–30/mo, `ai-org.md` §8) — and every dollar
now shows up on `/ops` from the first run, because Phase 0 is underneath it.

---

**Once Phase 1 ships, the org has staff.** Two engineers turning specs and rot
into reviewed PRs, and two revenue agents keeping the pipeline warm and every door
pre-pitched — all metered, all capped, all reporting into the CFO layer. Then
Phase 2 (Market Intelligence) can put the scraper and change-watcher on a shift.
