// Pure read models for the Analytics sheet. Everything is derived from the
// current ProspectView[] (the merged prospect + pipeline state) — no extra
// fetching. Each section degrades gracefully: callers render counts or a
// "not enough data" state, never an empty chart.

import type { ProspectView } from './types';
import { reachedRank, LOST_REASONS, type LostReason, type Stage } from './stages';

// Gate thresholds: below these, a percentage / breakdown would mislead.
export const CONVERSION_GATE = 20;
export const LOST_GATE = 10;

// ---- Funnel (cumulative reached) -------------------------------------------
// Counts narrow down the funnel: a prospect at Quoted also counts toward
// Knocked and Talked (via FUNNEL_RANK). Lost is reported separately.
export interface FunnelData {
  knocked: number;
  talked: number;
  quoted: number;
  won: number;
  lost: number;
}

export function funnel(views: ProspectView[]): FunnelData {
  const f: FunnelData = { knocked: 0, talked: 0, quoted: 0, won: 0, lost: 0 };
  for (const v of views) {
    const r = reachedRank(v.stage);
    if (r >= 1) f.knocked++;
    if (r >= 2) f.talked++;
    if (r >= 3) f.quoted++;
    if (v.stage === 'client') f.won++;
    if (v.stage === 'lost') f.lost++;
  }
  return f;
}

// ---- Weekly activity --------------------------------------------------------
// Per lifecycle stage: how many prospects MOVED to that stage this calendar week
// (Mon-start, local) vs last week, using stage_updated_at. The leading indicator.
export interface WeekStat {
  stage: Stage;
  label: string;
  thisWeek: number;
  lastWeek: number;
  delta: number;
}

const WEEKLY_STAGES: { stage: Stage; label: string }[] = [
  { stage: 'knocked', label: 'Knocked' },
  { stage: 'talked', label: 'Talked' },
  { stage: 'quoted', label: 'Quoted' },
  { stage: 'client', label: 'Won' },
  { stage: 'lost', label: 'Lost' },
];

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const mondayOffset = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

export function weeklyActivity(views: ProspectView[], now: Date = new Date()): WeekStat[] {
  const thisStart = startOfWeek(now).getTime();
  const lastStart = thisStart - 7 * 24 * 60 * 60 * 1000;
  return WEEKLY_STAGES.map(({ stage, label }) => {
    let thisWeek = 0;
    let lastWeek = 0;
    for (const v of views) {
      if (v.stage !== stage || !v.stage_updated_at) continue;
      const t = new Date(v.stage_updated_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= thisStart) thisWeek++;
      else if (t >= lastStart) lastWeek++;
    }
    return { stage, label, thisWeek, lastWeek, delta: thisWeek - lastWeek };
  });
}

// ---- Conversion rates (gated) ----------------------------------------------
export interface ConversionRow {
  label: string;
  parent: number;
  child: number;
  ready: boolean; // parent >= CONVERSION_GATE
  rate: number | null; // child / parent when ready (0..1)
  need: number; // CONVERSION_GATE - parent when not ready
}

export function conversions(f: FunnelData): ConversionRow[] {
  const row = (label: string, parent: number, child: number): ConversionRow => {
    const ready = parent >= CONVERSION_GATE;
    return {
      label,
      parent,
      child,
      ready,
      rate: ready ? child / parent : null,
      need: Math.max(0, CONVERSION_GATE - parent),
    };
  };
  return [
    row('Knocked → Talked', f.knocked, f.talked),
    row('Talked → Quoted', f.talked, f.quoted),
    row('Quoted → Won', f.quoted, f.won),
  ];
}

// ---- By neighborhood --------------------------------------------------------
// Quoted (reached ≥ quoted) and Won (client) per district, sorted by Won desc.
export interface NeighborhoodRow {
  neighborhood: string;
  quoted: number;
  won: number;
}

export function byNeighborhood(views: ProspectView[]): NeighborhoodRow[] {
  const map = new Map<string, { quoted: number; won: number }>();
  for (const v of views) {
    if (reachedRank(v.stage) < 3) continue; // only quoted-or-beyond contribute
    const nb = v.neighborhood || 'Unknown';
    const cur = map.get(nb) ?? { quoted: 0, won: 0 };
    cur.quoted++;
    if (v.stage === 'client') cur.won++;
    map.set(nb, cur);
  }
  return [...map.entries()]
    .map(([neighborhood, c]) => ({ neighborhood, ...c }))
    .sort((a, b) => b.won - a.won || b.quoted - a.quoted);
}

// ---- Lost reasons (gated) ---------------------------------------------------
export interface LostReasonRow {
  reason: LostReason;
  count: number;
}
export interface LostReasonsData {
  ready: boolean; // total >= LOST_GATE
  total: number;
  need: number;
  rows: LostReasonRow[]; // non-zero reasons, descending
}

export function lostReasons(views: ProspectView[]): LostReasonsData {
  const lost = views.filter((v) => v.stage === 'lost');
  const counts = new Map<LostReason, number>();
  for (const v of lost) {
    const raw = v.lost_reason as LostReason | null;
    const reason: LostReason = raw && LOST_REASONS.includes(raw) ? raw : 'other';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const rows = LOST_REASONS.map((reason) => ({ reason, count: counts.get(reason) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  return {
    ready: lost.length >= LOST_GATE,
    total: lost.length,
    need: Math.max(0, LOST_GATE - lost.length),
    rows,
  };
}
