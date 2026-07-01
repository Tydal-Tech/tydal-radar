import { describe, it, expect } from 'vitest';
import {
  underwrite,
  winProbability,
  contractValue,
  timingMultiplier,
  effort,
} from './underwriting';
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
    stage_updated_at: null,
    ...p,
  };
}

describe('winProbability', () => {
  it('rises along the pipeline', () => {
    expect(winProbability(v('quoted'))).toBeGreaterThan(winProbability(v('not_knocked')));
  });
  it('nudges up for quality signals but stays ≤ 1', () => {
    expect(
      winProbability(v('quoted', { rating: 4.8, website: 'https://x.com' })),
    ).toBeGreaterThan(winProbability(v('quoted')));
    expect(winProbability(v('client'))).toBeLessThanOrEqual(1);
  });
});

describe('contractValue', () => {
  it('scales with type baseline and review size', () => {
    expect(contractValue(v('not_knocked', { type: 'office' }))).toBeGreaterThan(
      contractValue(v('not_knocked', { type: 'dental' })),
    );
    const small = contractValue(v('not_knocked', { user_rating_count: 0 }));
    const big = contractValue(v('not_knocked', { user_rating_count: 300 }));
    expect(big).toBeGreaterThan(small);
  });
  it('caps the size multiplier', () => {
    const huge = contractValue(v('not_knocked', { type: 'office', user_rating_count: 100_000 }));
    expect(huge).toBe(Math.round(900 * 2)); // 2× cap
  });
});

describe('timingMultiplier', () => {
  it('is 1 with no in-market signal, higher when newly opened or urgent', () => {
    expect(timingMultiplier(v('not_knocked'))).toBe(1);
    const fresh = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(timingMultiplier(v('not_knocked', { first_seen: fresh }))).toBeGreaterThan(1);
    expect(timingMultiplier(v('not_knocked', { follow_up_date: '2000-01-01' }))).toBeGreaterThan(1);
  });
});

describe('effort', () => {
  it('increases with distance from the origin', () => {
    const near = effort(v('not_knocked'), { lat: 45.5, lng: -73.57 });
    const far = effort(v('not_knocked'), { lat: 45.6, lng: -73.7 });
    expect(far).toBeGreaterThan(near);
  });
  it('is lower for prospects further along the pipeline', () => {
    expect(effort(v('quoted'))).toBeLessThan(effort(v('not_knocked')));
  });
});

describe('underwrite', () => {
  it('zeroes acquisition EV for won/dead prospects', () => {
    expect(underwrite(v('client')).ev).toBe(0);
    expect(underwrite(v('lost')).ev).toBe(0);
    expect(underwrite(v('not_interested')).ev).toBe(0);
  });

  it('ranks a big, newly-opened, nearby office above a small, distant, cold dental', () => {
    const origin = { lat: 45.5, lng: -73.57 };
    const fresh = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const hot = underwrite(
      v('not_knocked', { type: 'office', user_rating_count: 300, rating: 4.7, first_seen: fresh }),
      origin,
    );
    const cold = underwrite(
      v('not_knocked', { type: 'dental', user_rating_count: 3, lat: 45.62, lng: -73.72 }),
      origin,
    );
    expect(hot.ev).toBeGreaterThan(cold.ev);
  });

  it('assigns value bands by estimated $', () => {
    expect(underwrite(v('not_knocked', { type: 'office', user_rating_count: 300 })).valueBand).toBe(
      '$$$',
    );
    expect(underwrite(v('not_knocked', { type: 'veterinary', user_rating_count: 0 })).valueBand).toBe(
      '$',
    );
  });
});
