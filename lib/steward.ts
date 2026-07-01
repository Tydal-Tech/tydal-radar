// Pipeline Steward (Phase 1, Revenue): the daily read of pipeline health. Pure
// selection logic — going-cold active deals + follow-ups due/overdue — so it's
// unit-tested; the cron route (app/api/ops/steward) does the DB read, the Claude
// digest (via runAgent), the escalation tasks, and the push. It logs and alerts;
// it never messages a prospect.

import { STALE_DAYS } from './staleness';
import type { Stage } from './stages';

const ACTIVE_STAGES: readonly Stage[] = ['knocked', 'talked', 'quoted'];

export interface StewardRow {
  place_id: string;
  name: string;
  stage: Stage;
  stage_updated_at: string | null;
  follow_up_date: string | null; // YYYY-MM-DD
}

export interface ColdDeal {
  place_id: string;
  name: string;
  stage: Stage;
  daysStale: number;
}

export interface StewardDigest {
  goingCold: ColdDeal[];
  escalations: ColdDeal[]; // high-intent (a quote is out) going cold → raise a task
  dueToday: number;
  overdue: number;
  facts: string[]; // human-readable lines that feed the Claude digest prompt
  actionable: boolean; // anything worth a run/push at all?
}

export function computeSteward(rows: StewardRow[], now: Date = new Date(), staleDays = STALE_DAYS): StewardDigest {
  const today = now.toISOString().slice(0, 10);
  const goingCold: ColdDeal[] = [];
  let dueToday = 0;
  let overdue = 0;

  for (const r of rows) {
    if (ACTIVE_STAGES.includes(r.stage) && r.stage_updated_at) {
      const t = Date.parse(r.stage_updated_at);
      if (!Number.isNaN(t)) {
        const days = Math.floor((now.getTime() - t) / 86_400_000);
        if (days >= staleDays) goingCold.push({ place_id: r.place_id, name: r.name, stage: r.stage, daysStale: days });
      }
    }
    if (r.follow_up_date) {
      if (r.follow_up_date < today) overdue += 1;
      else if (r.follow_up_date === today) dueToday += 1;
    }
  }

  goingCold.sort((a, b) => b.daysStale - a.daysStale);
  // A quote that's going cold is the costliest to lose → the one that needs a nudge.
  const escalations = goingCold.filter((d) => d.stage === 'quoted');

  const facts: string[] = [];
  if (dueToday || overdue) facts.push(`Follow-ups: ${dueToday} due today, ${overdue} overdue.`);
  if (goingCold.length) {
    const worst = goingCold.slice(0, 5).map((d) => `${d.name} (${d.stage}, ${d.daysStale}d)`).join('; ');
    facts.push(`${goingCold.length} active deal(s) going cold (${staleDays}+ days untouched). Worst: ${worst}.`);
  }

  return { goingCold, escalations, dueToday, overdue, facts, actionable: facts.length > 0 };
}
