import { describe, it, expect } from 'vitest';
import {
  parseExpiry,
  expiryStatus,
  formatExpiry,
  urgency,
  isUrgent,
  EXPIRY_COLOR,
} from './contracts';
import type { ProspectView } from './types';

function makeView(p: Partial<ProspectView> = {}): ProspectView {
  return {
    place_id: 'p1',
    name: 'Test',
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

describe('parseExpiry', () => {
  const parseable: [string, string][] = [
    // ISO YYYY-MM / YYYY-M / YYYY-MM-DD
    ['2027-03', '2027-03'],
    ['2027-3', '2027-03'],
    ['2027-03-15', '2027-03'],
    ['2027-12', '2027-12'],
    ['2027-01', '2027-01'],
    ['2030-09-01', '2030-09'],
    // MM/YYYY and M-YYYY (four-digit year required)
    ['03/2027', '2027-03'],
    ['3/2027', '2027-03'],
    ['3-2027', '2027-03'],
    ['12/2027', '2027-12'],
    ['1/2099', '2099-01'],
    // YYYY/MM (slash form)
    ['2027/03', '2027-03'],
    ['2027/3', '2027-03'],
    // Month name + four-digit year, either order, abbreviations, case-insensitive
    ['March 2027', '2027-03'],
    ['march 2027', '2027-03'],
    ['MARCH 2027', '2027-03'],
    ['Mar 2027', '2027-03'],
    ['2027 Mar', '2027-03'],
    ['2027 March', '2027-03'],
    ['January 2024', '2024-01'],
    ['Jan 2024', '2024-01'],
    ['February 2025', '2025-02'],
    ['Feb 2025', '2025-02'],
    ['April 2026', '2026-04'],
    ['Apr 2026', '2026-04'],
    ['May 2026', '2026-05'],
    ['June 2026', '2026-06'],
    ['Jun 2026', '2026-06'],
    ['July 2026', '2026-07'],
    ['Jul 2026', '2026-07'],
    ['August 2026', '2026-08'],
    ['Aug 2026', '2026-08'],
    ['September 2025', '2025-09'],
    ['Sept 2025', '2025-09'],
    ['Sep 2025', '2025-09'],
    ['October 2026', '2026-10'],
    ['Oct 2026', '2026-10'],
    ['November 2026', '2026-11'],
    ['Nov 2026', '2026-11'],
    ['December 2030', '2030-12'],
    ['Dec 2030', '2030-12'],
    // whitespace trimmed
    ['  2027-03  ', '2027-03'],
    ['  March 2027 ', '2027-03'],
  ];
  it.each(parseable)('parses %j -> %j', (input, expected) => {
    expect(parseExpiry(input)).toBe(expected);
  });

  const unparseable: (string | null | undefined)[] = [
    null,
    undefined,
    '',
    '   ',
    '2027', // bare year — never guess the month
    '03-09', // ambiguous all-two-digit pair
    '03/09',
    '12-11',
    'unknown',
    'TBD',
    'next year',
    'soon',
    'n/a',
    '2027-13', // month out of range
    '2027-00',
    '13/2027',
    '0/2027',
    '2027/13',
  ];
  it.each(unparseable)('rejects %j', (input) => {
    expect(parseExpiry(input)).toBeNull();
  });
});

describe('expiryStatus', () => {
  const today = new Date(2027, 0, 1); // Jan 1 2027 (local)
  const cases: [string, number, string][] = [
    ['2027-01', 0, 'red'],
    ['2027-02', 31, 'red'],
    ['2027-04', 90, 'red'], // exactly 90 days → red (<= 90)
    ['2027-05', 120, 'amber'],
    ['2027-06', 151, 'amber'],
    ['2027-07', 181, 'default'], // > 180 → default
    ['2026-12', -31, 'red'], // already past → red
  ];
  it.each(cases)('%s -> daysUntil %d, bucket %s', (ym, days, bucket) => {
    const r = expiryStatus(ym, today);
    expect(r.daysUntil).toBe(days);
    expect(r.bucket).toBe(bucket);
  });

  it('uses ascending day boundaries (red <= 90 < amber <= 180 < default)', () => {
    expect(expiryStatus('2027-04', today).bucket).toBe('red'); // 90
    expect(expiryStatus('2027-05', today).bucket).toBe('amber'); // 120
    expect(expiryStatus('2027-07', today).bucket).toBe('default'); // 181
  });
});

describe('formatExpiry', () => {
  it('renders short month + full year', () => {
    expect(formatExpiry('2027-03')).toMatch(/Mar/);
    expect(formatExpiry('2027-03')).toContain('2027');
    expect(formatExpiry('2027-12')).toMatch(/Dec/);
    expect(formatExpiry('2024-01')).toMatch(/Jan/);
  });
});

describe('urgency / isUrgent', () => {
  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM

  it('is red when a follow-up is due/overdue', () => {
    expect(urgency(makeView({ follow_up_date: '2000-01-01' }))).toBe('red');
    expect(isUrgent(makeView({ follow_up_date: '2000-01-01' }))).toBe(true);
  });

  it('is not urgent for a far-future follow-up and no contract', () => {
    expect(urgency(makeView({ follow_up_date: '2999-12-31' }))).toBeNull();
    expect(isUrgent(makeView({ follow_up_date: '2999-12-31' }))).toBe(false);
  });

  it('is null with no follow-up and no contract', () => {
    expect(urgency(makeView())).toBeNull();
    expect(isUrgent(makeView())).toBe(false);
  });

  it('is red when the contract expires this month (within 90 days)', () => {
    expect(urgency(makeView({ contract_expiry: thisMonth }))).toBe('red');
  });

  it('is null for a contract far in the future', () => {
    expect(urgency(makeView({ contract_expiry: '2999-01' }))).toBeNull();
  });

  it('ignores unparseable contract expiry', () => {
    expect(urgency(makeView({ contract_expiry: 'unknown' }))).toBeNull();
  });
});

describe('EXPIRY_COLOR', () => {
  it('has a color for red and amber and an empty default', () => {
    expect(EXPIRY_COLOR.red).toMatch(/^#/);
    expect(EXPIRY_COLOR.amber).toMatch(/^#/);
    expect(EXPIRY_COLOR.default).toBe('');
  });
});
