import { describe, it, expect } from 'vitest';
import { distanceMeters, formatDistance } from './geo';

describe('distanceMeters', () => {
  it('is 0 for the same point', () => {
    expect(distanceMeters({ lat: 45.5, lng: -73.57 }, { lat: 45.5, lng: -73.57 })).toBe(0);
  });

  it('is ~1113 m per 0.01° of latitude', () => {
    const d = distanceMeters({ lat: 45.5, lng: -73.57 }, { lat: 45.51, lng: -73.57 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1125);
  });

  it('is symmetric', () => {
    const a = { lat: 45.5019, lng: -73.5674 };
    const b = { lat: 45.5088, lng: -73.5541 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it('matches a known Montreal pair (~1.3 km, downtown → Plateau)', () => {
    const downtown = { lat: 45.5019, lng: -73.5674 };
    const plateau = { lat: 45.5088, lng: -73.5878 };
    const d = distanceMeters(downtown, plateau);
    expect(d).toBeGreaterThan(1400);
    expect(d).toBeLessThan(1900);
  });
});

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [4, '0 m'],
    [12, '10 m'],
    [224, '220 m'],
    [999, '1000 m'],
    [1000, '1.0 km'],
    [1240, '1.2 km'],
    [9950, '9.9 km'],
    [12000, '12 km'],
  ])('formats %d m as %s', (m, expected) => {
    expect(formatDistance(m)).toBe(expected);
  });
});
