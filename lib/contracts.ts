// Contract-expiry helpers. `contract_expiry` is stored as free text historically
// (e.g. "March 2027") and as normalized "YYYY-MM" going forward (native month
// picker). These parse / classify / format it for the Contracts tab and the
// one-time migration script.

import type { ProspectView } from '@/lib/types';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function ym(year: number, month: number): string | null {
  if (month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Normalize a free-text contract expiry to "YYYY-MM", or null if unparseable.
 * Deliberately rejects ambiguous all-two-digit pairs like "03-09" / "03/09"
 * (no four-digit year) and bare years — we never guess the month.
 */
export function parseExpiry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO: YYYY-MM or YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return ym(Number(m[1]), Number(m[2]));

  // MM/YYYY or M-YYYY (four-digit year required)
  m = s.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) return ym(Number(m[2]), Number(m[1]));

  // YYYY/MM (slash form; dash form handled by the ISO case above)
  m = s.match(/^(\d{4})[/-](\d{1,2})$/);
  if (m) return ym(Number(m[1]), Number(m[2]));

  // Month name + four-digit year, in either order (e.g. "March 2027", "2027 Mar").
  const year = s.match(/\b(\d{4})\b/);
  if (year) {
    for (const tok of s.toLowerCase().match(/[a-zéû]+/g) ?? []) {
      if (MONTHS[tok]) return ym(Number(year[1]), MONTHS[tok]);
    }
  }

  // Anything else (bare year, "03-09", "unknown", junk) → unparseable.
  return null;
}

export type ExpiryBucket = 'red' | 'amber' | 'default';

/** Days until the first of the expiry month, plus a color bucket. */
export function expiryStatus(
  monthYear: string,
  today: Date = new Date(),
): { daysUntil: number; bucket: ExpiryBucket } {
  const [y, mo] = monthYear.split('-').map(Number);
  const date = new Date(y, mo - 1, 1);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntil = Math.round((date.getTime() - start.getTime()) / 86_400_000);
  const bucket: ExpiryBucket = daysUntil <= 90 ? 'red' : daysUntil <= 180 ? 'amber' : 'default';
  return { daysUntil, bucket };
}

/** "YYYY-MM" → "Mar 2027". */
export function formatExpiry(monthYear: string): string {
  const [y, mo] = monthYear.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
}

/**
 * Urgency of a prospect for "needs attention" surfacing (map pin badge + filter):
 * RED — a follow-up is due/overdue today, or the contract expires within ~90 days;
 * AMBER — the contract expires within ~180 days; null otherwise.
 * "Today" is the local calendar date (same convention as FollowUps' todayStr()).
 */
export function urgency(v: ProspectView): 'red' | 'amber' | null {
  const today = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
  if (v.follow_up_date && v.follow_up_date <= today) return 'red';
  const ym = parseExpiry(v.contract_expiry);
  if (ym) {
    const { bucket } = expiryStatus(ym);
    if (bucket === 'red') return 'red';
    if (bucket === 'amber') return 'amber';
  }
  return null;
}

export const isUrgent = (v: ProspectView) => urgency(v) !== null;

export const EXPIRY_COLOR: Record<ExpiryBucket, string> = {
  red: '#d93025',
  amber: '#f9ab00',
  default: '',
};
