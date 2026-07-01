// Lead score: a 0–100 "work this now" ranking that turns the enriched data into
// a prioritized hit-list. Pure + unit-tested. Combines opportunity (stage),
// size/quality (reviews + rating), timing (contract/follow-up urgency), and
// legitimacy (has a website).

import { urgency } from './contracts';
import type { Stage } from './stages';
import type { ProspectView } from './types';

// Opportunity by stage (0–30): unworked doors have the most upside; won/dead none.
const STAGE_OPPORTUNITY: Record<Stage, number> = {
  not_knocked: 30,
  follow_up: 26,
  knocked: 22,
  quoted: 20,
  talked: 18,
  lost: 5,
  client: 0,
  not_interested: 0,
};

export interface LeadScore {
  score: number; // 0–100
  reasons: string[]; // the notable positive contributors
}

// A business first seen within this window is treated as newly opened.
export const NEW_WINDOW_DAYS = 60;

/** True if the prospect was first scraped recently (→ likely no cleaning contract yet). */
export function isNewlyOpened(firstSeen: string | null | undefined, now: Date = new Date()): boolean {
  if (!firstSeen) return false;
  const t = Date.parse(firstSeen);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime() && now.getTime() - t <= NEW_WINDOW_DAYS * 86_400_000;
}

export function leadScore(v: ProspectView): LeadScore {
  let score = STAGE_OPPORTUNITY[v.stage];
  const reasons: string[] = [];

  // Size / activity from review count (~500 reviews saturates at 25).
  if (v.user_rating_count != null) {
    const pts = Math.min(25, Math.floor(v.user_rating_count / 20));
    score += pts;
    if (pts >= 10) reasons.push('established (lots of reviews)');
  }

  // Quality from rating (0–10).
  if (v.rating != null) {
    const pts = v.rating >= 4.5 ? 10 : v.rating >= 4 ? 6 : v.rating >= 3 ? 2 : 0;
    score += pts;
    if (v.rating >= 4.5) reasons.push('highly rated');
  }

  // Timing: an expiring contract or due follow-up is the strongest buy signal.
  const urg = urgency(v);
  if (urg === 'red') {
    score += 25;
    reasons.push('contract expiring / follow-up due');
  } else if (urg === 'amber') {
    score += 12;
    reasons.push('contract expiring soon');
  }

  // Newly opened → no cleaning contract locked in yet: the hottest domain signal.
  if (isNewlyOpened(v.first_seen)) {
    score += 20;
    reasons.push('newly opened — likely no cleaning contract yet');
  }

  // Legitimacy: a real website.
  if (v.website) score += 3;

  return { score: Math.min(100, Math.round(score)), reasons };
}
