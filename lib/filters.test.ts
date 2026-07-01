import { describe, it, expect } from 'vitest';
import { EMPTY_FILTERS, anyActiveFilter, matchesFilters, type Filters } from './filters';
import type { ProspectView } from './types';

function makeView(p: Partial<ProspectView> = {}): ProspectView {
  return {
    place_id: 'p1',
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
    stage: 'not_knocked',
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
const f = (p: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...p });

describe('EMPTY_FILTERS', () => {
  it('is a no-op filter (matches everything, not active)', () => {
    expect(anyActiveFilter(EMPTY_FILTERS)).toBe(false);
    expect(matchesFilters(makeView(), EMPTY_FILTERS)).toBe(true);
    expect(matchesFilters(makeView({ type: 'medical', stage: 'client' }), EMPTY_FILTERS)).toBe(true);
  });
});

describe('anyActiveFilter', () => {
  it('is false only for the empty filter', () => {
    expect(anyActiveFilter(f())).toBe(false);
  });
  it.each([
    ['nb', f({ nb: 'Plateau-Mont-Royal' })],
    ['types', f({ types: ['dental'] })],
    ['stage', f({ stage: 'client' })],
    ['attention', f({ attention: true })],
    ['nearMe', f({ nearMe: true })],
  ] as [string, Filters][])('is true when %s is set', (_label, filters) => {
    expect(anyActiveFilter(filters)).toBe(true);
  });
});

describe('matchesFilters — neighborhood', () => {
  it('matches only the selected neighborhood', () => {
    const v = makeView({ neighborhood: 'Ville-Marie' });
    expect(matchesFilters(v, f({ nb: 'Ville-Marie' }))).toBe(true);
    expect(matchesFilters(v, f({ nb: 'Plateau-Mont-Royal' }))).toBe(false);
    expect(matchesFilters(v, f({ nb: 'all' }))).toBe(true);
  });
});

describe('matchesFilters — types (multi-select)', () => {
  it('empty set matches every type', () => {
    for (const t of ['dental', 'daycare', 'gym', 'office', 'veterinary', 'medical'] as const) {
      expect(matchesFilters(makeView({ type: t }), f({ types: [] }))).toBe(true);
    }
  });
  it('matches any selected type, excludes the rest', () => {
    const sel = f({ types: ['dental', 'office'] });
    expect(matchesFilters(makeView({ type: 'dental' }), sel)).toBe(true);
    expect(matchesFilters(makeView({ type: 'office' }), sel)).toBe(true);
    expect(matchesFilters(makeView({ type: 'gym' }), sel)).toBe(false);
    expect(matchesFilters(makeView({ type: 'medical' }), sel)).toBe(false);
  });
});

describe('matchesFilters — stage', () => {
  it('matches only the selected stage', () => {
    const v = makeView({ stage: 'client' });
    expect(matchesFilters(v, f({ stage: 'client' }))).toBe(true);
    expect(matchesFilters(v, f({ stage: 'lost' }))).toBe(false);
    expect(matchesFilters(v, f({ stage: 'all' }))).toBe(true);
  });
});

describe('matchesFilters — attention (urgency)', () => {
  const urgent = makeView({ follow_up_date: '2000-01-01' }); // overdue → urgent
  const calm = makeView({ follow_up_date: '2999-12-31' }); // far future → not urgent
  it('only filters when attention is on', () => {
    expect(matchesFilters(calm, f({ attention: false }))).toBe(true);
    expect(matchesFilters(urgent, f({ attention: true }))).toBe(true);
    expect(matchesFilters(calm, f({ attention: true }))).toBe(false);
  });
});

describe('matchesFilters — near me', () => {
  const here = { lat: 45.5, lng: -73.57 };
  it('ignores nearMe when there is no GPS fix (origin absent)', () => {
    expect(matchesFilters(makeView({ lat: 46, lng: -74 }), f({ nearMe: true }))).toBe(true);
  });
  it('includes prospects within the radius, excludes those beyond', () => {
    expect(matchesFilters(makeView({ lat: 45.5009, lng: -73.57 }), f({ nearMe: true }), here)).toBe(true);
    expect(matchesFilters(makeView({ lat: 45.6, lng: -73.57 }), f({ nearMe: true }), here)).toBe(false);
  });
});

describe('matchesFilters — combined (AND)', () => {
  it('requires every active facet to pass', () => {
    const v = makeView({ neighborhood: 'Plateau-Mont-Royal', type: 'gym', stage: 'talked' });
    expect(
      matchesFilters(v, f({ nb: 'Plateau-Mont-Royal', types: ['gym'], stage: 'talked' })),
    ).toBe(true);
    // one facet mismatches → excluded
    expect(matchesFilters(v, f({ nb: 'Plateau-Mont-Royal', types: ['dental'] }))).toBe(false);
    expect(matchesFilters(v, f({ stage: 'client' }))).toBe(false);
  });
});
