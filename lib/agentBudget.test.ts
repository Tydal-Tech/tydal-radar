import { describe, it, expect } from 'vitest';
import { periodStart, evaluateBudgets, thresholdsCrossed, type Period } from './agentBudget';

describe('periodStart (UTC)', () => {
  const now = new Date('2026-07-15T18:30:00Z'); // a Wednesday

  it('day → midnight UTC today', () => {
    expect(periodStart('day', now).toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  it('month → first of the month UTC', () => {
    expect(periodStart('month', now).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('week → most recent Monday UTC', () => {
    // 2026-07-15 is a Wednesday → Monday is 2026-07-13.
    expect(periodStart('week', now).toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  it('week on a Monday returns that same day', () => {
    const monday = new Date('2026-07-13T09:00:00Z');
    expect(periodStart('week', monday).toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  it('week on a Sunday returns the prior Monday', () => {
    const sunday = new Date('2026-07-19T09:00:00Z');
    expect(periodStart('week', sunday).toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });
});

describe('evaluateBudgets', () => {
  const rows: { scope: string; period: Period; limit_usd: number }[] = [
    { scope: 'global', period: 'day', limit_usd: 5 },
    { scope: 'global', period: 'month', limit_usd: 75 },
    { scope: 'dept:revenue', period: 'day', limit_usd: 2 },
  ];

  it('is not blocked when all scopes are under cap', () => {
    // global/day 1/5=20%, global/month 0.5/75≈0.7%, revenue/day 0.5/2=25%
    const r = evaluateBudgets(rows, (s, p) => (s === 'global' && p === 'day' ? 1 : 0.5));
    expect(r.blocked).toBe(false);
    expect(r.lines).toHaveLength(3);
    expect(r.worst?.scope).toBe('dept:revenue'); // 25% is highest
  });

  it('blocks when any scope hits 100% of its cap', () => {
    const r = evaluateBudgets(rows, (s, p) => (s === 'dept:revenue' ? 2 : 0)); // revenue/day 2/2 = 100%
    expect(r.blocked).toBe(true);
    expect(r.worst).toMatchObject({ scope: 'dept:revenue', period: 'day', pct: 100 });
  });

  it('surfaces the worst (highest %) line', () => {
    // global/month 60/75=80%, revenue/day 1.8/2=90%, global/day 0
    const r = evaluateBudgets(rows, (s, p) =>
      s === 'global' && p === 'month' ? 60 : s === 'dept:revenue' ? 1.8 : 0,
    );
    expect(r.worst?.scope).toBe('dept:revenue'); // 90% > 80%
    expect(r.blocked).toBe(false);
  });

  it('treats a zero/absent limit as 0% (never blocks on it)', () => {
    const r = evaluateBudgets([{ scope: 'role:x', period: 'day', limit_usd: 0 }], () => 100);
    expect(r.blocked).toBe(false);
    expect(r.lines[0].pct).toBe(0);
  });
});

describe('thresholdsCrossed', () => {
  it('fires only on the run that crosses the mark (transition, not level)', () => {
    // $5 cap: 80% mark = $4. A run taking spend $3.90 → $4.20 crosses 80%.
    expect(thresholdsCrossed(3.9, 4.2, 5)).toEqual([80]);
    // Already past $4 before the run → no re-alert.
    expect(thresholdsCrossed(4.2, 4.5, 5)).toEqual([]);
    // Still under $4 after the run → not yet.
    expect(thresholdsCrossed(3.0, 3.9, 5)).toEqual([]);
  });

  it('can cross 80% and 100% in the same big run', () => {
    // $5 cap: a run from $3.50 → $5.10 clears both the $4 and $5 marks.
    expect(thresholdsCrossed(3.5, 5.1, 5)).toEqual([80, 100]);
  });

  it('fires 100% exactly when spend reaches the cap', () => {
    expect(thresholdsCrossed(4.6, 5.0, 5)).toEqual([100]);
  });

  it('never fires for a zero/negative cap', () => {
    expect(thresholdsCrossed(0, 999, 0)).toEqual([]);
  });
});
