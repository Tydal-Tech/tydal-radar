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

// Industry / descriptor / corporate words that carry no brand identity. A name
// built only from these (e.g. "Clinique Dentaire", "Garderie Éducative") repeats
// across UNRELATED businesses, so an exact match on it is NOT a chain — it would
// be a false "sister location". EN + FR (Montréal), plus corporate suffixes.
const GENERIC_TOKENS = new Set([
  // dental
  'dental', 'dentaire', 'dentiste', 'dentist', 'orthodontiste', 'denturologiste',
  // medical / clinic
  'clinique', 'clinic', 'medical', 'medicale', 'medecin', 'sante', 'docteur', 'doctor',
  'cabinet', 'centre', 'center', 'hopital', 'hospital', 'polyclinique',
  // gym
  'gym', 'gymnase', 'fitness', 'entrainement', 'sport', 'sports', 'studio', 'yoga',
  // daycare
  'daycare', 'garderie', 'cpe', 'prematernelle', 'educative', 'educatif',
  // veterinary
  'veterinary', 'veterinaire', 'animal', 'animalier', 'animaux',
  // office / professional
  'office', 'bureau', 'services', 'service', 'avocat', 'avocats', 'notaire', 'notaires',
  'comptable', 'comptables', 'comptabilite', 'immobilier', 'assurance', 'assurances',
  'consultant', 'consultants', 'groupe', 'group', 'associes', 'firme', 'firm',
  // corporate suffixes + stopwords
  'inc', 'ltd', 'ltee', 'llc', 'corp', 'enr', 'srl', 'co',
  'de', 'du', 'des', 'la', 'le', 'les', 'et', 'and', 'the', 'of', 'en', 'au', 'aux',
]);

/** True when a name is only generic industry/descriptor words — no brand to chain on. */
export function isGenericName(name: string): boolean {
  const distinctive = chainKey(name)
    .split(' ')
    .filter((t) => t.length > 2 && !GENERIC_TOKENS.has(t));
  return distinctive.length === 0;
}

export interface Expansion {
  sameBuilding: ProspectView[]; // co-tenants at the client's address
  sisters: ProspectView[]; // same-chain locations elsewhere
}

const WON = 'client';

export function expansionTargets(client: ProspectView, all: ProspectView[]): Expansion {
  const bk = buildingKey(client.address);
  const ck = chainKey(client.name);
  // Only chase "sisters" when the name carries a real brand — a generic name
  // ("Clinique Dentaire") would match unrelated businesses, not a chain.
  const chainable = !isGenericName(client.name);

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
    if (chainable && chainKey(v.name) === ck) sisters.push(v);
  }

  return { sameBuilding, sisters };
}
