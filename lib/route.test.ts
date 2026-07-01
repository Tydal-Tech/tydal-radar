import { describe, it, expect } from 'vitest';
import { planRoute } from './route';
import { distanceMeters } from './geo';

// A few points strung roughly east from an origin, given out of order.
const origin = { lat: 45.5, lng: -73.6 };
const p = (id: string, lng: number) => ({ id, lat: 45.5, lng });
const far = p('far', -73.57); // ~2.3 km E
const mid = p('mid', -73.585); // ~1.2 km E
const near = p('near', -73.595); // ~0.4 km E

describe('planRoute', () => {
  it('returns [] for no points', () => {
    expect(planRoute(origin, [])).toEqual([]);
  });

  it('orders nearest-neighbour from the origin', () => {
    const stops = planRoute(origin, [far, near, mid]);
    expect(stops.map((s) => s.item.id)).toEqual(['near', 'mid', 'far']);
  });

  it('reports per-leg and cumulative distance (cumulative = running sum)', () => {
    const stops = planRoute(origin, [far, near, mid]);
    // first leg is origin → nearest
    expect(stops[0].legMeters).toBeCloseTo(distanceMeters(origin, near), 3);
    expect(stops[0].cumulativeMeters).toBeCloseTo(stops[0].legMeters, 3);
    // cumulative is monotonic and equals the sum of legs
    let sum = 0;
    for (const s of stops) {
      sum += s.legMeters;
      expect(s.cumulativeMeters).toBeCloseTo(sum, 3);
    }
  });

  it('caps the number of stops', () => {
    const many = Array.from({ length: 30 }, (_, i) => p(`x${i}`, -73.6 + (i + 1) * 0.001));
    expect(planRoute(origin, many, 10)).toHaveLength(10);
  });

  it('does not mutate the input array', () => {
    const input = [far, near, mid];
    planRoute(origin, input);
    expect(input.map((x) => x.id)).toEqual(['far', 'near', 'mid']);
  });
});
