// Expansion graph: from a won client, surface warm expansion targets — other
// businesses in the SAME building (you're already on-site / have a reference)
// and SISTER LOCATIONS of the same chain (same normalized name). Pure + tested.

import type { ProspectView } from './types';
import { buildingKey } from './buildings';

/** Chain key: lowercase, strip accents/punctuation → so exact-brand repeats match. */
export function chainKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Expansion {
  sameBuilding: ProspectView[]; // co-tenants at the client's address
  sisters: ProspectView[]; // same-chain locations elsewhere
}

const WON = 'client';

export function expansionTargets(client: ProspectView, all: ProspectView[]): Expansion {
  const bk = buildingKey(client.address);
  const ck = chainKey(client.name);

  const sameBuilding: ProspectView[] = [];
  const sisters: ProspectView[] = [];

  for (const v of all) {
    if (v.place_id === client.place_id) continue;
    if (v.stage === WON) continue; // already a client — not a target
    const sameBk = bk != null && buildingKey(v.address) === bk;
    if (sameBk) {
      sameBuilding.push(v);
      continue; // count each prospect once, building takes precedence
    }
    if (chainKey(v.name) === ck) sisters.push(v);
  }

  return { sameBuilding, sisters };
}
