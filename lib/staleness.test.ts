import { describe, it, expect } from 'vitest';
import { staleDeals, STALE_DAYS } from './staleness';
import type { ProspectView } from './types';
import type { Stage } from './stages';

function v(stage: Stage, stageUpdatedAt: string | null, id = Math.random().toString(36)): ProspectView {
  return {
    place_id: id,
    name: id,
    type: 'dental',
    neighborhood: 'NDG',
    lat: 45.5,
    lng: -73.57,
    phone: null,
    address: '1 Main St',
    rating: null,
    user_rating_count: null,
    website: null,
    stage,
    note: null,
    contact_name: null,
    current_provider: null,
    contract_expiry: null,
    follow_up_date: null,
    lost_reason: null,
    stage_updated_at: stageUpdatedAt,
  };
}

const now = new Date('2026-07-01T00:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe('staleDeals', () => {
  it('flags active-stage prospects untouched past the threshold, worst first', () => {
    const views = [
      v('quoted', daysAgo(30), 'a'),
      v('talked', daysAgo(20), 'b'),
      v('knocked', daysAgo(3), 'c'), // fresh → not stale
    ];
    const stale = staleDeals(views, now);
    expect(stale.map((s) => s.view.place_id)).toEqual(['a', 'b']);
    expect(stale[0].daysStale).toBe(30);
  });

  it('ignores terminal / unworked stages and follow_up', () => {
    const views = [
      v('not_knocked', daysAgo(90), 'a'),
      v('client', daysAgo(90), 'b'),
      v('lost', daysAgo(90), 'c'),
      v('follow_up', daysAgo(90), 'd'),
    ];
    expect(staleDeals(views, now)).toEqual([]);
  });

  it('ignores rows without a valid stage_updated_at', () => {
    expect(staleDeals([v('quoted', null, 'a'), v('quoted', 'nope', 'b')], now)).toEqual([]);
  });

  it('respects a custom threshold', () => {
    const views = [v('talked', daysAgo(10), 'a')];
    expect(staleDeals(views, now, 7)).toHaveLength(1);
    expect(staleDeals(views, now, STALE_DAYS)).toHaveLength(0);
  });
});
