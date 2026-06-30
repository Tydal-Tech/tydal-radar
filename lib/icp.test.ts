import { describe, it, expect } from 'vitest';
import {
  ICP,
  ICP_TYPES,
  ICP_SEARCHES,
  ICP_EMOJI,
  NEIGHBORHOODS,
  TYPE_DENYLIST,
  MAP_CENTER,
  MAP_ZOOM,
} from './icp';
import type { IcpType } from './types';

const TYPES: IcpType[] = ['daycare', 'dental', 'gym', 'office', 'veterinary', 'medical'];

describe('ICP type maps', () => {
  it('ICP_TYPES is the keys of ICP and matches the known type set', () => {
    expect(ICP_TYPES).toEqual(Object.keys(ICP));
    expect([...ICP_TYPES].sort()).toEqual([...TYPES].sort());
  });

  it('ICP and ICP_EMOJI are keyed by exactly the type set', () => {
    expect(Object.keys(ICP).sort()).toEqual([...TYPES].sort());
    expect(Object.keys(ICP_EMOJI).sort()).toEqual([...TYPES].sort());
  });

  it.each(TYPES)('%s has a non-empty label and emoji', (t) => {
    expect(ICP[t].label.length).toBeGreaterThan(0);
    expect(ICP_EMOJI[t].length).toBeGreaterThan(0);
  });
});

describe('ICP_SEARCHES', () => {
  it('every search has a known type, non-empty query and includedType', () => {
    for (const s of ICP_SEARCHES) {
      expect(TYPES).toContain(s.type);
      expect(s.query.trim().length).toBeGreaterThan(0);
      expect(s.includedType.trim().length).toBeGreaterThan(0);
    }
  });

  it('covers every ICP type at least once', () => {
    const covered = new Set(ICP_SEARCHES.map((s) => s.type));
    for (const t of TYPES) expect(covered.has(t)).toBe(true);
  });

  it('office is three merged professional searches', () => {
    const office = ICP_SEARCHES.filter((s) => s.type === 'office');
    expect(office).toHaveLength(3);
    expect(office.map((s) => s.includedType).sort()).toEqual([
      'accounting',
      'lawyer',
      'real_estate_agency',
    ]);
  });

  it('lists medical before office so overlaps dedupe as medical', () => {
    const medical = ICP_SEARCHES.findIndex((s) => s.type === 'medical');
    const office = ICP_SEARCHES.findIndex((s) => s.type === 'office');
    expect(medical).toBeGreaterThanOrEqual(0);
    expect(office).toBeGreaterThanOrEqual(0);
    expect(medical).toBeLessThan(office);
  });

  it('uses a distinct includedType per search', () => {
    const types = ICP_SEARCHES.map((s) => s.includedType);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('NEIGHBORHOODS', () => {
  it('has 4 distinct named neighborhoods', () => {
    expect(NEIGHBORHOODS).toHaveLength(4);
    expect(new Set(NEIGHBORHOODS.map((n) => n.name)).size).toBe(4);
  });

  it.each(NEIGHBORHOODS)('$name has a sane Montreal bounding box', ({ bounds }) => {
    expect(bounds.south).toBeLessThan(bounds.north);
    expect(bounds.west).toBeLessThan(bounds.east);
    expect(bounds.south).toBeGreaterThan(45.3);
    expect(bounds.north).toBeLessThan(45.8);
    expect(bounds.west).toBeGreaterThan(-74);
    expect(bounds.east).toBeLessThan(-73.3);
  });
});

describe('denylist + map config', () => {
  it('TYPE_DENYLIST drops non-ICP categories', () => {
    expect(TYPE_DENYLIST.size).toBeGreaterThan(0);
    expect(TYPE_DENYLIST.has('hospital')).toBe(true);
    expect(TYPE_DENYLIST.has('bank')).toBe(true);
  });

  it('MAP_CENTER is in Montreal and MAP_ZOOM is valid', () => {
    expect(MAP_CENTER.lat).toBeGreaterThan(45.3);
    expect(MAP_CENTER.lat).toBeLessThan(45.8);
    expect(MAP_CENTER.lng).toBeGreaterThan(-74);
    expect(MAP_CENTER.lng).toBeLessThan(-73.3);
    expect(MAP_ZOOM).toBeGreaterThanOrEqual(1);
    expect(MAP_ZOOM).toBeLessThanOrEqual(22);
  });
});
