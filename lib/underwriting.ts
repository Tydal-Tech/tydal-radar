// The market & sales underwriting engine.
//
// Score every prospect on expected value per unit of effort:
//
//     EV = ( P_win × ContractValue × Timing × Confidence ) ÷ Effort
//
// A transparent, tunable heuristic today — but the shape is deliberate: each
// term is isolated so it can be swapped for a fitted model once enough pipeline
// outcomes accumulate (P_win → logistic, ContractValue → firmographic, Effort →
// learned touch-counts). The $ figures are rough proxies for RANKING, not
// quotes; relative order is what matters until we can calibrate on real wins.

import type { ProspectView, IcpType } from './types';
import type { Stage } from './stages';
import { urgency } from './contracts';
import { isNewlyOpened } from './score';
import { distanceMeters, type LatLng } from './geo';

// Terminal stages have no acquisition value (won = already closed; dead = dead).
// Expansion from won clients is handled separately (see lib/expansion.ts).
const DEAD: readonly Stage[] = ['client', 'lost', 'not_interested'];

// --- P(win): probability this door becomes a client, 0..1 -------------------
const STAGE_PWIN: Record<Stage, number> = {
  not_knocked: 0.05,
  knocked: 0.1,
  talked: 0.18,
  follow_up: 0.25,
  quoted: 0.35,
  client: 1,
  lost: 0,
  not_interested: 0.01,
};

export function winProbability(v: ProspectView): number {
  let p = STAGE_PWIN[v.stage];
  if (!DEAD.includes(v.stage)) {
    if ((v.rating ?? 0) >= 4.5) p *= 1.1; // well-run businesses are easier to deal with
    if (v.website) p *= 1.05;
  }
  return Math.max(0, Math.min(1, p));
}

// --- ContractValue: expected monthly $ from size/type proxies ----------------
// Cleaning $ scales with floor area, frequency and rigor. Per-type baselines
// (offices/medical need more frequent, rigorous cleaning) × a size multiplier
// proxied by review count (footfall/scale).
const TYPE_BASE: Record<IcpType, number> = {
  office: 900,
  medical: 850,
  gym: 700,
  daycare: 600,
  dental: 500,
  veterinary: 450,
};

export function contractValue(v: ProspectView): number {
  const base = TYPE_BASE[v.type as IcpType] ?? 500;
  const reviews = v.user_rating_count ?? 0;
  const sizeMult = Math.min(2, 0.6 + reviews / 250); // 0 rev → 0.6×, ~350 rev → 2× cap
  return Math.round(base * sizeMult);
}

// --- Timing: in-market multiplier -------------------------------------------
export function timingMultiplier(v: ProspectView): number {
  let m = 1;
  if (isNewlyOpened(v.first_seen)) m *= 1.6; // no cleaning contract locked in yet
  const u = urgency(v);
  if (u === 'red') m *= 1.5; // contract expiring / follow-up due
  else if (u === 'amber') m *= 1.2;
  return m;
}

// --- Confidence: how much we trust the inputs (down-weights thin data) -------
export function confidence(v: ProspectView): number {
  let c = 0.5;
  if (v.rating != null) c += 0.2;
  if (v.user_rating_count != null) c += 0.15;
  if (v.address) c += 0.15;
  return Math.min(1, c);
}

// --- Effort: expected touches-to-close × travel cost -------------------------
const STAGE_TOUCHES: Record<Stage, number> = {
  not_knocked: 4,
  knocked: 3,
  talked: 2.5,
  follow_up: 2,
  quoted: 1.5,
  client: 1,
  lost: 1,
  not_interested: 1,
};

export function effort(v: ProspectView, origin?: LatLng): number {
  const touches = STAGE_TOUCHES[v.stage];
  const travel = origin ? 1 + distanceMeters(origin, v) / 2000 : 1; // +1 per 2 km
  return touches * travel;
}

export type ValueBand = '$' | '$$' | '$$$';

export interface Underwriting {
  ev: number; // expected $/effort — the ranking key
  pWin: number;
  value: number; // $/mo estimate
  timing: number;
  confidence: number;
  effort: number;
  valueBand: ValueBand;
  dead: boolean;
}

export function underwrite(v: ProspectView, origin?: LatLng): Underwriting {
  const pWin = winProbability(v);
  const value = contractValue(v);
  const timing = timingMultiplier(v);
  const conf = confidence(v);
  const eff = effort(v, origin);
  const valueBand: ValueBand = value >= 1200 ? '$$$' : value >= 700 ? '$$' : '$';
  const dead = DEAD.includes(v.stage);
  // Acquisition EV: zero for won/dead so targeting never re-surfaces them.
  const ev = dead ? 0 : Math.round((pWin * value * timing * conf) / eff);
  return { ev, pWin, value, timing, confidence: conf, effort: eff, valueBand, dead };
}
