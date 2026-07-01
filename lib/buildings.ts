// Co-location / decision-maker locus.
//
// For commercial cleaning, the contract in a multi-tenant building is usually
// held by the PROPERTY MANAGER, not each tenant. So a business that is the SOLE
// occupant of its address is the one that actually controls its own cleaning —
// a direct-pitch target — while a shared address routes through a PM (a
// different sales motion). This groups prospects by building so the UI can flag
// which is which.

interface HasAddress {
  place_id: string;
  address: string | null;
}

// Strip unit/suite tokens so "1250 René-Lévesque Suite 400" and
// "1250 René-Lévesque Bureau 900" collapse to the same building. `#` is handled
// separately from the word tokens (it's not a word char, so \b doesn't apply);
// collision-prone words like "office"/"local" are deliberately excluded.
const UNIT_RE = /\s*(?:\b(?:suite|ste|unit|apt|apartment|bureau)\b\.?|#)\s*\S+/gi;

/** Crude building key from a street address, or null if there's no address. */
export function buildingKey(address: string | null | undefined): string | null {
  if (!address) return null;
  const street = address.split(',')[0] ?? '';
  const key = street.replace(UNIT_RE, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return key || null;
}

/** building key -> place_ids sharing it. */
export type BuildingIndex = Map<string, string[]>;

export function buildIndex(prospects: HasAddress[]): BuildingIndex {
  const byKey: BuildingIndex = new Map();
  for (const p of prospects) {
    const k = buildingKey(p.address);
    if (!k) continue;
    const arr = byKey.get(k);
    if (arr) arr.push(p.place_id);
    else byKey.set(k, [p.place_id]);
  }
  return byKey;
}

export interface CoLocation {
  known: boolean; // false when the prospect has no address to key on
  count: number; // businesses sharing this address (incl. self)
  soleOccupant: boolean; // the only business at this address → controls own cleaning
  others: string[]; // other place_ids at this address
}

export function coLocation(index: BuildingIndex, p: HasAddress): CoLocation {
  const k = buildingKey(p.address);
  if (!k) return { known: false, count: 1, soleOccupant: false, others: [] };
  const ids = index.get(k) ?? [p.place_id];
  return {
    known: true,
    count: ids.length,
    soleOccupant: ids.length <= 1,
    others: ids.filter((id) => id !== p.place_id),
  };
}
