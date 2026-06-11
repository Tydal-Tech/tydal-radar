// Pipeline stages, their display labels, and the brand colors used for pins,
// badges, and chips throughout the app. Single source of truth.

export type Stage =
  | 'not_knocked'
  | 'knocked'
  | 'talked'
  | 'quoted'
  | 'follow_up'
  | 'client'
  | 'lost'
  | 'not_interested';

export const STAGES: Stage[] = [
  'not_knocked',
  'knocked',
  'talked',
  'quoted',
  'follow_up',
  'client',
  'lost',
  'not_interested',
];

export const STAGE_LABELS: Record<Stage, string> = {
  not_knocked: 'Not knocked',
  knocked: 'Knocked',
  talked: 'Talked',
  quoted: 'Quoted',
  follow_up: 'Follow-up',
  client: 'Client',
  lost: 'Lost',
  not_interested: 'Not interested',
};

export const STAGE_COLORS: Record<Stage, string> = {
  // Dark slate (was a light grey) so the white pin glyph stays legible and the
  // most-common stage reads as a quiet backdrop while active stages pop.
  not_knocked: '#5b6470',
  knocked: '#f9ab00',
  talked: '#1a73e8',
  quoted: '#7c5cff', // indigo — a live quote is out
  follow_up: '#06b6d4',
  client: '#1e8e3e',
  lost: '#8a3a3a', // dark red — quoted then lost (distinct from not_interested)
  not_interested: '#d93025', // red — dead / rejected
};

// Text color that reads well on top of each stage color (for badges/glyphs).
export const STAGE_ON_COLOR: Record<Stage, string> = {
  not_knocked: '#ffffff',
  knocked: '#1a1f36',
  talked: '#ffffff',
  quoted: '#ffffff',
  follow_up: '#0b3b44',
  client: '#ffffff',
  lost: '#ffffff',
  not_interested: '#ffffff',
};

// Reasons a quoted deal was lost — set on the prospect card when stage = 'lost',
// stored verbatim in pipeline.lost_reason, and broken down in Analytics.
export type LostReason = 'price' | 'timing' | 'competitor' | 'no_response' | 'other';

export const LOST_REASONS: LostReason[] = ['price', 'timing', 'competitor', 'no_response', 'other'];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  price: 'Price',
  timing: 'Timing',
  competitor: 'Competitor',
  no_response: 'No response',
  other: 'Other',
};

// How far down the Knocked → Talked → Quoted → Won funnel a prospect has reached,
// inferred from its current stage (we store only the current stage, not history).
// Branch stages map to the furthest level they imply: follow_up came after a talk
// (2), lost came after a quote (3), an early door "no" counts as knocked (1).
// Drives the cumulative funnel + conversion rates in lib/analytics.ts.
export const FUNNEL_RANK: Record<Stage, number> = {
  not_knocked: 0,
  knocked: 1,
  not_interested: 1,
  talked: 2,
  follow_up: 2,
  quoted: 3,
  lost: 3,
  client: 4,
};

export function reachedRank(stage: Stage): number {
  return FUNNEL_RANK[stage];
}
