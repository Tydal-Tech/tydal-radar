# Tydal AI Organization — Operating Blueprint

> **Living document.** This is the master plan for running Tydal's internal
> operations as an AI-staffed organization: many narrow agents, organized into
> departments and ranks, executing at machine speed and scale under human
> command. Update it as the org grows — it is the org chart, the job
> descriptions, the rules of engagement, and the rollout plan in one place.
>
> Status: **blueprint** (nothing here is auto-running yet). Rollout is phased —
> see §12. Last updated: 2026-07-01.

---

## 0. Doctrine — why this exists

**Objective: own the Montréal commercial-cleaning market.** Not "compete in" —
**own**. The path to that isn't a secret; it's *relentless execution at a speed
and coverage no human-run competitor can match*:

- **Total coverage.** Every eligible business on the island is mapped, scored,
  and worked. No prospect falls through.
- **First to every opening.** A business opens or an RFP posts — we're the first
  pitch in the door, before anyone else knows it exists.
- **Best intelligence.** We know each prospect's incumbent, their contract
  timing, their cleanliness complaints, their growth. Competitors run
  spreadsheets; we run a living market model.
- **Relentless follow-up.** No deal goes cold. No follow-up is forgotten.
- **Sharper pricing.** Every bid is underwritten and priced on real signal.
- **A compounding moat.** Every knock, scrape, won bid, and lost reason feeds
  the machine. The gap widens every month. That compounding is the whole game.

**The operating philosophy:** you (the CEO) set the direction and hold the
approvals. The AI org does the work — at 3am, in parallel, without fatigue.
Agents *propose*; you *dispose*.

**Rules of engagement — win clean, win permanent.** Aggression is operational
(speed, coverage, follow-up, price), never dirty. No fake reviews, no
astroturfing, no smearing competitors, no ToS-violating scraping, no price
collusion, no dishonest bids. This isn't caution — it's moat protection: a
competitor can't take back a market from a company that simply out-executes
them, but a CASL fine or a Law 25 privacy complaint can hand it right back. We
stay un-sue-able and un-cancellable *while* we take everything. (Full rules: §11.)

---

## 1. The operating model

```
                    YOU — CEO / Board
   sets strategy · approves money, bids, deploys, contracts, outbound
                          │  (propose → dispose)
              Chief of Staff — master orchestrator
                          │
        ┌────────────┬─────┴──────┬────────────┬────────────┐
     Directors (department heads / coordinators)
        │            │            │            │            │
     Seniors (specialists)   ·   Juniors (workers)   ·   fan-out instances
        └──── shared: Company Wiki · Handbook · CFO/budgets · The Office ────┘
```

- **You are the CEO and the board.** Strategy and the approval gates are yours.
- **Chief of Staff** is the master orchestrator: routes work to directors,
  synthesizes the board pack, enforces budget and guardrails.
- **Directors** own a department: plan the work, delegate, **review** their
  team's output, report up.
- **Seniors** do substantive specialist work. **Juniors** do high-volume routine
  work. Each is *narrow* — one job, minimum context.

> **Mechanic — the hierarchy is composed, not one deep tree.** The agent tooling
> delegates one level (a coordinator → its workers). A four-rank org is built by
> **stacking** those layers: the Chief triggers Director sessions; each Director
> is a coordinator over its workers. Real, but assembled — design for layered
> orchestration, not a single 4-deep tree.

---

## 2. The rank ladder

Seniority = the model/effort/cost ladder. Cheap juniors do the grunt work; the
Opus chief does the thinking. This is what makes a large org affordable.

| Rank | Model / effort | ~Cost/run | Authority | Reports to |
|---|---|---|---|---|
| **Junior** | Haiku, low | cents | Execute a single narrow task; no side effects | Senior / Director |
| **Senior** | Sonnet 5, high | ~$0.20–1 | Own a specialist output; open PRs / drafts | Director |
| **Director** | Sonnet/Opus, high–xhigh | ~$1–3 | Plan + delegate + **review** a department | Chief of Staff |
| **Chief of Staff** | Opus, xhigh–max | ~$2–5 | Cross-dept synthesis, routing, budget enforcement | CEO |
| **CEO (you)** | human | — | Strategy + all approval gates | — |

**No rank spends money, sends anything outward, deploys to prod, or touches
contracts without the CEO's yes.** (§11.)

---

## 3. Departments & role catalog

The org is **~18 narrow roles** across six departments. Each role is scoped to
one job with the minimum context it needs, on the cheapest model that can do it.
The *count* of live agents is emergent (see fan-out, §4) — this is the role
catalog, not a headcount.

Format per role — **Model · Context budget · Inputs → Outputs · Escalates when.**

### 🛠 Engineering & Product — *the radar app, website, pricing engine*
**Director: Eng Director** (Sonnet/Opus) — owns the roadmap, reviews every PR.

- **Maintenance Engineer** · Haiku, low · tiny · repo state → dependency bumps,
  lint/test fixes, small cleanups as a PR · escalates: any change touching auth,
  data, or payments.
- **Feature Engineer** · Sonnet, high · medium (one feature's files) · a spec →
  a branch → CI → preview → PR · escalates: schema changes, new external deps,
  anything user-facing it can't self-verify.
- **QA / Test Engineer** · Haiku, low · small · a PR → tests written + run +
  preview checked → pass/fail report · escalates: a failing gate on `main`.
- **Reliability Monitor** · Haiku, low · streaming logs → incident report when
  errors spike · escalates: any production error.

### 🔭 Market Intelligence — *radar data, competitors, bidding directories*
**Director: Intel Director** (Sonnet) — decides what to watch and how deep.

- **Market Scraper** · Haiku, low · grid config → fresh scrape + enriched rows +
  snapshot · escalates: quota-cap hits, big anomalies.
- **Directory Scout** · Haiku, low · a bidding/RFP/tender directory → new
  postings, flagged by fit · escalates: a high-fit RFP with a near deadline.
- **Change Watcher** · Haiku, low · two snapshots → openings / closures / rating
  & review-momentum shifts → alerts · escalates: a cluster of openings (a hot
  zone) or a big incumbent churn.
- **Competitor Analyst** · Sonnet, high · market + pipeline data → competitor
  territory maps, incumbent tracking, displacement targets · escalates: a
  competitor weakening in a zone (a strike opportunity).

### 💰 Pricing & Underwriting — *the pricing engine, bid pricing, risk*
**Director: Pricing Director** (Sonnet/Opus) — owns pricing policy.

- **Cost Estimator** · Haiku, low · a prospect/site → size, frequency, labor,
  rigor inputs + a raw cost calc · escalates: missing size data it can't infer.
- **Pricing Analyst** · Sonnet, high · cost inputs + won-deal history → a priced
  quote with a defensible band + sensitivity · escalates: a price outside policy
  bounds.
- **Underwriter** · Sonnet, high · a prospect/bid → P(win) × value × timing ×
  effort score with reasons (the underwriting engine) · escalates: a high-value
  target that needs a strategy call.

### 📣 Revenue / Sales — *pitches, pipeline, follow-ups, outreach*
**Director: Revenue Director** (Sonnet) — owns the number.

- **Pitch Writer** · Haiku→Sonnet · tiny (one prospect's signals) → a bilingual
  (FR-vous / EN) door pitch: opener, rebuttals, ask-for, angle · escalates:
  never (you review at the door). *High fan-out — see §4.*
- **Pipeline Steward** · Haiku, low · pipeline state → stale-deal alerts,
  follow-up scheduling, outcome logging · escalates: a going-cold high-value deal.
- **Outreach Drafter** · Sonnet, high · a contact + context → a drafted email /
  message / proposal cover · escalates: **always — you send, never the agent** (§11).

### 📑 Bids & Proposals — *directories → qualify → price → propose*
**Director: Bids Director** (Sonnet/Opus) — owns the win rate on tenders.

- **Bid Qualifier** · Sonnet, high · an RFP + our fit profile → go/no-go score +
  rationale · escalates: a strong-fit, high-value RFP.
- **Proposal Writer** · Sonnet, high · a qualified RFP + pricing + intel → a
  complete proposal draft · escalates: **always — you approve every submission** (§11).

### 🧭 Operations & Reporting — *reports, action plans, the board*
**Chief of Staff** (Opus, max) — the top orchestrator.

- **Reporting Analyst** · Haiku, low · all-dept metrics → dashboards, freshness
  and coverage stats · escalates: a KPI breaching a threshold.
- **Action-Plan Builder** · Sonnet, high · data + goals → a concrete weekly
  action plan ("hit these 40 doors, chase these 6 RFPs, price these 3") ·
  escalates: plan conflicts / resource limits.
- **Chief of Staff** · Opus, max · everything → the **weekly board pack**
  ("what happened · what to do · what needs your yes") + routes work + enforces
  budget · escalates: strategy, spend over cap, anything outward.

---

## 4. Fan-out doctrine — roles × instances

**Don't target an agent count.** Define the ~18 roles above; scale *instances*
of a role only when volume demands, then retire them.

- **Pitch Writer** → spin **1 per prospect** on the day's route (10, 30, 100 on
  a big canvassing day), all in parallel, gone when done.
- **Directory Scout** → **1 per directory** you monitor.
- **Competitor Analyst** → **1 per competitor** for deep dives.
- **Feature Engineer** → **1 per independent workstream** so they don't collide.

So "100 agents" is a *busy Tuesday*, not a fixed org size — the number emerges
from the workload and collapses back down.

**Limits to design around:** ~20 roles in a coordinator's roster, multiple
copies each, up to **25 concurrent worker threads per session**; org-level
request-rate caps. Past a handful, you **batch and queue**, never fire hundreds
at once.

---

## 5. Context economy — how "many narrow agents" stays cheap

Agent *count* isn't the cost lever — total tokens is, plus a coordination tax.
These keep both small:

- **Context isolation** — each worker gets only the slice of data its one job
  needs; nobody carries the whole company in-context.
- **Cheapest capable model per role** — Haiku for scraping/parsing/monitoring;
  Sonnet only where reasoning earns it; Opus only at the top.
- **Programmatic tool calling** — big tool outputs are processed in code; only
  the distilled result enters the agent's context.
- **Tool search + skills** — load only the tools/instructions a task needs.
- **Compaction + context editing** — summarize/clear stale history on long runs.
- **Prompt caching** — shared system prompts (the handbook, role briefs) bill at
  ~10% on repeats.
- **Short-lived sessions** — a fresh agent per task beats one long session that
  hoards context forever.

**Over-decomposition has a cost too** (handoff tax). The sweet spot is *narrow
roles + cheap models + tight context*, not "maximize agent count."

---

## 6. Corporate infrastructure — what makes it an org, not a pile of bots

| Function | Implementation |
|---|---|
| **Company Wiki** | A shared memory store — decisions, SOPs, learnings, playbooks. Directors write; juniors read. |
| **Employee Handbook** | `AGENTS.md` (built) — the rules every agent obeys. |
| **The Office** | The repo + CI gate + preview deploys + the locked-down database (all built). Engineers work here. |
| **Shifts & standups** | Scheduled runs: daily briefing, weekly department reviews, monthly board report. |
| **CFO** | Per-agent **task budgets** (hard token caps) + a cost dashboard + spend alerts. This is **observability** — mandatory before anything runs unsupervised. |
| **Approval gates** | The CEO (you). See §11. |

---

## 7. Cross-department playbooks

**Win a public bid (the org collaborating):**
Directory Scout finds an RFP → Bid Qualifier scores it go → Underwriter + Cost
Estimator + Pricing Analyst price it → Proposal Writer assembles it → Chief of
Staff packages → **you approve + submit**.

**Own the day's territory:**
Change Watcher flags overnight openings → Underwriter scores them → Action-Plan
Builder sequences the route → Pitch Writers pre-draft every door's pitch →
you knock with the plan + pitches in hand → Pipeline Steward logs outcomes →
tomorrow's plan is sharper.

**The Monday board pack:**
Reporting Analyst compiles metrics → Directors submit department readouts →
Chief of Staff synthesizes "what happened · what to do this week · what needs
your yes" → you decide.

---

## 8. Cost model

You pay for **tokens consumed**, not seats — cost starts near zero and scales
with work done. `cost ≈ runs × tokens/run × price/token`. Anchor: one bilingual
pitch ≈ **1.5¢** (Sonnet) / **<1¢** (Haiku).

| Tier | What's live | Claude tokens/mo | + Data (Places/directories) | + Infra |
|---|---|---|---|---|
| **Lean** (start here) | Eng + Revenue, on-demand + daily jobs, Haiku/Sonnet, caching | ~$10–30 | your capped scrape spend | ~$0 |
| **Moderate** | +Intel +Pricing, several daily agents | ~$50–150 | + | ~$0–20 |
| **Full org** | all depts, daily, some Opus, orchestrator | ~$150–500+ | + | ~$20–40 |
| **Peak fan-out day** | 100+ ephemeral Haiku workers | spikes, then settles | + | — |

**Control levers:** Haiku for routine · task budgets (per-agent caps) · prompt
caching · on-demand over scheduled · low effort for simple jobs · Opus only at
the top.

---

## 9. Dominance scoreboard (KPIs)

How we measure "owning the market":

- **Coverage** — % of eligible island businesses mapped + scored (target: ~100%).
- **Speed-to-opening** — median hours from a business opening to first pitch.
- **RFP response time** — median hours from posting to submitted proposal.
- **Win rate** — by segment (dental / daycare / gym / office / …).
- **Pipeline velocity** — knocked → talked → quoted → won, per week.
- **Data freshness** — median age of prospect data (target: < 30 days).
- **Cost-per-won-contract** — total AI + data spend ÷ contracts won.
- **AI cost as % of revenue** — keep it a rounding error against contract value.

---

## 10. Guardrails & rules of engagement

**Approval gates (CEO-only, no exceptions):** spending money / changing billing ·
submitting a bid or proposal · sending any outward message · deploying to
production · database schema or destructive data changes · signing/committing to
contracts · standing up new scheduled agents (budget impact).

**Win-clean rules (moat protection):**
- Compete on **merit** — coverage, speed, price, service. Never on sabotage.
- **No** fake reviews, astroturfing, or review manipulation (ours or theirs).
- **No** disparaging or false claims about competitors.
- **Respect site terms** on any scraping/monitoring; use official APIs where they
  exist; honor robots/ToS.
- **No** price-fixing, bid-rigging, or collusion.
- **Honest proposals** — no claims we can't deliver.
- **CASL** (anti-spam) compliance on every outbound message — consent,
  identification, unsubscribe. Drafts only; you send.
- **Law 25 / PIPEDA** (privacy) on any personal data — minimal collection,
  purpose limits, no compiling personal profiles beyond what the sale needs.
- **Secrets** never printed, committed, or handled in the clear (per `AGENTS.md`).

These aren't brakes on ambition — they're what makes the dominance *permanent*.

---

## 11. Phased rollout — build order

Don't hire the whole org on day one. Prerequisites first, then phase in;
each phase must prove it saves more than it costs before the next.

- **Phase 0 — CFO layer (build first).** Observability + per-agent budgets +
  cost/alert dashboard. You cannot run an org you can't see or cap.
- **Phase 1 — Engineering + Revenue (substrate exists today).** Maintenance +
  Feature engineers (PR → you merge); Pitch Writer + Pipeline Steward. Low risk,
  immediate value.
- **Phase 2 — Market Intelligence.** Scraper + Change Watcher + Competitor
  Analyst on a schedule; the monthly refresh becomes an agent.
- **Phase 3 — Pricing & Underwriting + Bids.** Needs the pricing-engine wired and
  a bidding-directory data source/integration.
- **Phase 4 — Chief of Staff + board pack.** Once ≥2 departments run cleanly,
  add the orchestrator and the weekly synthesis.

**Start here:** Phase 0 (observability), then Phase 1's Engineering + Revenue.

---

## 12. Living-doc protocol

- This file is the source of truth for the org design. Update it when a role,
  department, model choice, budget, or phase changes.
- Roles graduate models (Haiku → Sonnet → Opus) as their work proves it needs
  the reasoning — record the change and why.
- Kill roles that don't earn their cost; the org stays lean.
- Every phase that ships gets logged in `CHANGELOG.md` and `TYDAL_PROGRESS.md`.
