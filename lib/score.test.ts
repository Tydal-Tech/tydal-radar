import { describe, it, expect } from 'vitest';
import { leadScore } from './score';
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

describe('leadScore', () => {
  it('scores a bare unworked prospect on stage opportunity alone', () => {
    expect(leadScore(v('not_knocked'))).toEqual({ score: 30, reasons: [] });
  });

  it('gives won/dead prospects no opportunity points', () => {
    expect(leadScore(v('client')).score).toBe(0);
    expect(leadScore(v('not_interested')).score).toBe(0);
  });

  it('adds size (reviews, capped at 25) and quality (rating) points', () => {
    // 200 reviews → floor(200/20)=10; rating 4.7 → 10.
    const r = leadScore(v('not_knocked', { user_rating_count: 200, rating: 4.7 }));
    expect(r.score).toBe(30 + 10 + 10);
    expect(r.reasons).toContain('established (lots of reviews)');
    expect(r.reasons).toContain('highly rated');
  });

  it('caps the review contribution at 25', () => {
    const r = leadScore(v('not_knocked', { user_rating_count: 100_000 }));
    expect(r.score).toBe(30 + 25);
  });

  it('scales rating quality by band', () => {
    expect(leadScore(v('knocked', { rating: 4.2 })).score).toBe(22 + 6);
    expect(leadScore(v('knocked', { rating: 3.1 })).score).toBe(22 + 2);
    expect(leadScore(v('knocked', { rating: 2.0 })).score).toBe(22 + 0);
  });

  it('treats a due follow-up as the strongest timing signal', () => {
    const r = leadScore(v('follow_up', { follow_up_date: '2000-01-01' }));
    expect(r.score).toBe(26 + 25);
    expect(r.reasons).toContain('contract expiring / follow-up due');
  });

  it('adds a small bump for having a website', () => {
    expect(leadScore(v('not_knocked', { website: 'https://x.com' })).score).toBe(33);
  });

  it('sums every signal for a maxed-out profile (stays within the 0–100 cap)', () => {
    const r = leadScore(
      v('not_knocked', {
        user_rating_count: 100_000,
        rating: 5,
        follow_up_date: '2000-01-01',
        website: 'https://x.com',
      }),
    );
    expect(r.score).toBe(93); // 30 stage + 25 reviews + 10 rating + 25 timing + 3 website
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('ranks a hot lead above a cold one', () => {
    const hot = leadScore(v('not_knocked', { user_rating_count: 400, rating: 4.8 })).score;
    const cold = leadScore(v('client', { user_rating_count: 5, rating: 3.0 })).score;
    expect(hot).toBeGreaterThan(cold);
  });
});
