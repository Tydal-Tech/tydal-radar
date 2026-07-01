// Stale-deal leakage: prospects sitting untouched in an ACTIVE stage past a
// threshold are quietly going cold. Surface them so they get a follow-up before
// they leak out of the pipeline. Uses stage_updated_at (bumped on stage change).
// follow_up is handled by the Follow-ups view (it has its own due date), so it's
// excluded here to avoid double-surfacing.

import type { ProspectView } from './types';
import type { Stage } from './stages';

const ACTIVE: readonly Stage[] = ['knocked', 'talked', 'quoted'];
export const STALE_DAYS = 14;

export interface StaleDeal {
  view: ProspectView;
  daysStale: number;
}

export function staleDeals(
  views: ProspectView[],
  now: Date = new Date(),
  thresholdDays: number = STALE_DAYS,
): StaleDeal[] {
  const out: StaleDeal[] = [];
  for (const v of views) {
    if (!ACTIVE.includes(v.stage)) continue;
    if (!v.stage_updated_at) continue;
    const t = Date.parse(v.stage_updated_at);
    if (Number.isNaN(t)) continue;
    const days = Math.floor((now.getTime() - t) / 86_400_000);
    if (days >= thresholdDays) out.push({ view: v, daysStale: days });
  }
  return out.sort((a, b) => b.daysStale - a.daysStale);
}
