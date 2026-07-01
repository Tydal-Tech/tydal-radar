import { describe, it, expect } from 'vitest';
import { computeSteward, type StewardRow } from './steward';

const now = new Date('2026-07-15T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe('computeSteward', () => {
  it('flags active deals untouched 14+ days, worst first', () => {
    const rows: StewardRow[] = [
      { place_id: 'a', name: 'A', stage: 'knocked', stage_updated_at: daysAgo(20), follow_up_date: null },
      { place_id: 'b', name: 'B', stage: 'talked', stage_updated_at: daysAgo(30), follow_up_date: null },
      { place_id: 'c', name: 'C', stage: 'knocked', stage_updated_at: daysAgo(3), follow_up_date: null }, // fresh
    ];
    const d = computeSteward(rows, now);
    expect(d.goingCold.map((x) => x.place_id)).toEqual(['b', 'a']); // 30d before 20d
    expect(d.actionable).toBe(true);
  });

  it('never flags client/lost/not-knocked stages as going cold', () => {
    const rows: StewardRow[] = [
      { place_id: 'w', name: 'Client', stage: 'client', stage_updated_at: daysAgo(90), follow_up_date: null },
      { place_id: 'l', name: 'Lost', stage: 'lost', stage_updated_at: daysAgo(90), follow_up_date: null },
      { place_id: 'n', name: 'New', stage: 'not_knocked', stage_updated_at: daysAgo(90), follow_up_date: null },
    ];
    expect(computeSteward(rows, now).goingCold).toHaveLength(0);
  });

  it('escalates only going-cold quotes (the costliest to lose)', () => {
    const rows: StewardRow[] = [
      { place_id: 'q', name: 'Quote', stage: 'quoted', stage_updated_at: daysAgo(21), follow_up_date: null },
      { place_id: 'k', name: 'Knock', stage: 'knocked', stage_updated_at: daysAgo(21), follow_up_date: null },
    ];
    const d = computeSteward(rows, now);
    expect(d.escalations.map((x) => x.place_id)).toEqual(['q']);
  });

  it('counts follow-ups due today vs overdue', () => {
    const rows: StewardRow[] = [
      { place_id: '1', name: '1', stage: 'quoted', stage_updated_at: daysAgo(1), follow_up_date: '2026-07-15' }, // today
      { place_id: '2', name: '2', stage: 'quoted', stage_updated_at: daysAgo(1), follow_up_date: '2026-07-10' }, // overdue
      { place_id: '3', name: '3', stage: 'quoted', stage_updated_at: daysAgo(1), follow_up_date: '2026-08-01' }, // future
    ];
    const d = computeSteward(rows, now);
    expect(d.dueToday).toBe(1);
    expect(d.overdue).toBe(1);
  });

  it('is not actionable on an empty/quiet pipeline', () => {
    expect(computeSteward([], now).actionable).toBe(false);
  });
});
