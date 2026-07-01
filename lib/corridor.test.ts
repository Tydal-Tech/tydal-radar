import { describe, it, expect } from 'vitest';
import { sameTypeNearby } from './corridor';
import type { ProspectView } from './types';
import type { Stage } from './stages';
import type { IcpType } from './types';

// ~111 m per 0.001° latitude near Montréal.
function v(id: string, type: IcpType, stage: Stage, latOffset: number): ProspectView {
  return {
    place_id: id,
    name: id,
    type,
    neighborhood: 'NDG',
    lat: 45.5 + latOffset,
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
  };
}

describe('sameTypeNearby', () => {
  const anchor = v('anchor', 'dental', 'not_knocked', 0);
  const all = [
    anchor,
    v('near-same', 'dental', 'not_knocked', 0.001), // ~111 m, same type, unworked → in
    v('other-type', 'gym', 'not_knocked', 0.001), // different type → out
    v('worked', 'dental', 'knocked', 0.001), // already worked → out
    v('far-same', 'dental', 'not_knocked', 0.01), // ~1.1 km → out
    v('nearer-same', 'dental', 'not_knocked', 0.0005), // ~55 m → in, closer
  ];

  it('returns only unworked same-type prospects within the radius, nearest first', () => {
    const res = sameTypeNearby(anchor, all);
    expect(res.map((p) => p.place_id)).toEqual(['nearer-same', 'near-same']);
  });

  it('excludes the anchor itself', () => {
    expect(sameTypeNearby(anchor, all).some((p) => p.place_id === 'anchor')).toBe(false);
  });

  it('is empty when nothing of the type is nearby', () => {
    expect(sameTypeNearby(v('solo', 'veterinary', 'not_knocked', 0), all)).toEqual([]);
  });
});
