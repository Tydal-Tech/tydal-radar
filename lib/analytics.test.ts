import { describe, it, expect } from 'vitest';
import {
  funnel,
  conversions,
  weeklyActivity,
  byNeighborhood,
  lostReasons,
  coverage,
  competitors,
  CONVERSION_GATE,
  LOST_GATE,
  type FunnelData,
} from './analytics';
import type { ProspectView } from './types';
import type { Stage } from './stages';

function v(stage: Stage, p: Partial<ProspectView> = {}): ProspectView {
  return {
    place_id: Math.random().toString(36).slice(2),
    name: 'X',
    type: 'dental',
    neighborhood: 'Ville-Marie',
    lat: 45.5,
    lng: -73.57,
    phone: null,
    address: null,
    stage,
    note: null,
    contact_name: null,
    current_provider: null,
    contract_expiry: null,
    follow_up_date: null,
    lost_reason: null,
    stage_updated_at: null,
    ...p,
  };
}

describe('funnel', () => {
  it('counts cumulative reached ranks; won/lost separately', () => {
    const views = [
      v('not_knocked'),
      v('knocked'),
      v('talked'),
      v('quoted'),
      v('follow_up'),
      v('client'),
      v('lost'),
      v('not_interested'),
    ];
    expect(funnel(views)).toEqual({ knocked: 7, talked: 5, quoted: 3, won: 1, lost: 1 });
  });

  it('is all-zero for no views', () => {
    expect(funnel([])).toEqual({ knocked: 0, talked: 0, quoted: 0, won: 0, lost: 0 });
  });
});

describe('conversions', () => {
  it('gates rows below CONVERSION_GATE (rate null, need reported)', () => {
    const f: FunnelData = { knocked: 7, talked: 5, quoted: 3, won: 1, lost: 1 };
    const rows = conversions(f);
    expect(rows.map((r) => r.label)).toEqual([
      'Knocked → Talked',
      'Talked → Quoted',
      'Quoted → Won',
    ]);
    expect(rows[0]).toMatchObject({ parent: 7, child: 5, ready: false, rate: null, need: 13 });
    expect(rows[1]).toMatchObject({ parent: 5, child: 3, ready: false, rate: null, need: 15 });
    expect(rows[2]).toMatchObject({ parent: 3, child: 1, ready: false, rate: null, need: 17 });
  });

  it('reports rates once parent >= CONVERSION_GATE', () => {
    const f: FunnelData = { knocked: 50, talked: 25, quoted: 20, won: 5, lost: 3 };
    const rows = conversions(f);
    expect(rows[0]).toMatchObject({ ready: true, rate: 0.5, need: 0 });
    expect(rows[1]).toMatchObject({ ready: true, rate: 0.8, need: 0 });
    expect(rows[2]).toMatchObject({ ready: true, rate: 0.25, need: 0 });
  });

  it('CONVERSION_GATE is the boundary (>= gate is ready)', () => {
    const f: FunnelData = { knocked: CONVERSION_GATE, talked: 0, quoted: 0, won: 0, lost: 0 };
    expect(conversions(f)[0].ready).toBe(true);
  });
});

describe('weeklyActivity', () => {
  const now = new Date(2027, 0, 15, 12, 0, 0);
  const iso = (offsetDays: number) =>
    new Date(now.getTime() + offsetDays * 86_400_000).toISOString();

  it('buckets stage moves into this week vs last week by stage_updated_at', () => {
    const views = [
      v('knocked', { stage_updated_at: iso(0) }), // this week
      v('knocked', { stage_updated_at: iso(-7) }), // last week
      v('knocked', { stage_updated_at: iso(-14) }), // older → neither
      v('talked', { stage_updated_at: iso(0) }), // this week
      v('knocked', { stage_updated_at: null }), // ignored (no timestamp)
      v('knocked', { stage_updated_at: 'not-a-date' }), // ignored (NaN)
    ];
    const rows = weeklyActivity(views, now);
    const knocked = rows.find((r) => r.stage === 'knocked')!;
    const talked = rows.find((r) => r.stage === 'talked')!;
    expect(knocked).toMatchObject({ thisWeek: 1, lastWeek: 1, delta: 0 });
    expect(talked).toMatchObject({ thisWeek: 1, lastWeek: 0, delta: 1 });
  });

  it('reports the five weekly stages', () => {
    const rows = weeklyActivity([], now);
    expect(rows.map((r) => r.stage)).toEqual(['knocked', 'talked', 'quoted', 'client', 'lost']);
    for (const r of rows) expect(r).toMatchObject({ thisWeek: 0, lastWeek: 0, delta: 0 });
  });
});

describe('byNeighborhood', () => {
  it('counts quoted-or-beyond per district, sorted by won then quoted desc', () => {
    const views = [
      v('client', { neighborhood: 'Ville-Marie' }),
      v('quoted', { neighborhood: 'Ville-Marie' }),
      v('client', { neighborhood: 'Ville-Marie' }),
      v('client', { neighborhood: 'Plateau' }),
      v('lost', { neighborhood: 'Plateau' }), // lost reached quoted (rank 3)
      v('talked', { neighborhood: 'Plateau' }), // rank 2 → excluded
      v('quoted', { neighborhood: '' }), // empty → 'Unknown'
    ];
    expect(byNeighborhood(views)).toEqual([
      { neighborhood: 'Ville-Marie', quoted: 3, won: 2 },
      { neighborhood: 'Plateau', quoted: 2, won: 1 },
      { neighborhood: 'Unknown', quoted: 1, won: 0 },
    ]);
  });

  it('is empty when nothing reached quoted', () => {
    expect(byNeighborhood([v('knocked'), v('talked')])).toEqual([]);
  });
});

describe('lostReasons', () => {
  it('gates below LOST_GATE and reports non-zero reasons descending', () => {
    const views = [
      v('lost', { lost_reason: 'price' }),
      v('lost', { lost_reason: 'price' }),
      v('lost', { lost_reason: 'competitor' }),
    ];
    const r = lostReasons(views);
    expect(r).toMatchObject({ ready: false, total: 3, need: LOST_GATE - 3 });
    expect(r.rows).toEqual([
      { reason: 'price', count: 2 },
      { reason: 'competitor', count: 1 },
    ]);
  });

  it('maps unknown/missing reasons to "other"', () => {
    const views = [
      v('lost', { lost_reason: 'banana' }),
      v('lost', { lost_reason: null }),
    ];
    const r = lostReasons(views);
    expect(r.rows).toEqual([{ reason: 'other', count: 2 }]);
  });

  it('is ready once total >= LOST_GATE', () => {
    const views = Array.from({ length: LOST_GATE }, () => v('lost', { lost_reason: 'price' }));
    const r = lostReasons(views);
    expect(r).toMatchObject({ ready: true, total: LOST_GATE, need: 0 });
  });

  it('ignores non-lost prospects', () => {
    expect(lostReasons([v('client'), v('knocked')])).toMatchObject({ total: 0, rows: [] });
  });
});

describe('coverage', () => {
  it('summarizes market penetration by type, sorted by size', () => {
    const views = [
      v('not_knocked', { type: 'dental' }),
      v('knocked', { type: 'dental' }),
      v('client', { type: 'dental' }),
      v('not_knocked', { type: 'gym' }),
    ];
    const rows = coverage(views, 'type');
    expect(rows[0].label).toBe('dental'); // biggest segment first
    expect(rows.find((r) => r.label === 'dental')).toMatchObject({
      total: 3,
      worked: 2,
      won: 1,
      untapped: 1,
    });
    expect(rows.find((r) => r.label === 'gym')).toMatchObject({
      total: 1,
      worked: 0,
      won: 0,
      untapped: 1,
    });
  });

  it('summarizes by neighborhood, bucketing blanks as Unknown', () => {
    const rows = coverage(
      [v('knocked', { neighborhood: '' }), v('knocked', { neighborhood: 'Plateau' })],
      'neighborhood',
    );
    expect(rows.map((r) => r.label).sort()).toEqual(['Plateau', 'Unknown']);
  });
});

describe('competitors', () => {
  it('counts current providers descending, ignoring blanks/nulls', () => {
    const views = [
      v('talked', { current_provider: 'GDI' }),
      v('talked', { current_provider: 'GDI' }),
      v('talked', { current_provider: 'Bee-Clean' }),
      v('talked', { current_provider: '  ' }),
      v('talked', { current_provider: null }),
    ];
    expect(competitors(views)).toEqual([
      { provider: 'GDI', count: 2 },
      { provider: 'Bee-Clean', count: 1 },
    ]);
  });

  it('is empty when no providers are recorded', () => {
    expect(competitors([v('knocked')])).toEqual([]);
  });
});
