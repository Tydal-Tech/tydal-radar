import { ICP_SEARCHES, NEIGHBORHOODS, TYPE_DENYLIST } from './icp';
import type { Prospect, IcpType, Neighborhood } from './types';

const FIELDS = [
  'id',
  'displayName',
  'location',
  'formattedAddress',
  'nationalPhoneNumber',
  'types',
  'businessStatus',
];

export interface PullResult {
  prospects: Prospect[];
  queriesRun: number;
  errors: string[];
}

/**
 * Pull ICP prospects from Google Places (New) Text Search, client-side.
 * One query per (type × neighborhood), bounded by neighborhood, capped at the
 * SDK's max of 20 results/query, deduped by place_id, big-box/irrelevant
 * categories dropped. Only ever called from the manual "Refresh" button.
 */
export async function pullProspects(
  placesLib: google.maps.PlacesLibrary,
): Promise<PullResult> {
  const { Place } = placesLib;
  const byId = new Map<string, Prospect>();
  const errors: string[] = [];
  let queriesRun = 0;

  for (const nb of NEIGHBORHOODS) {
    for (const spec of ICP_SEARCHES) {
      try {
        const { places } = await Place.searchByText({
          textQuery: spec.query,
          fields: FIELDS,
          includedType: spec.includedType,
          locationRestriction: nb.bounds,
          maxResultCount: 20,
          useStrictTypeFiltering: false,
          language: 'en',
          region: 'CA',
        });
        queriesRun++;

        for (const p of places ?? []) {
          const prospect = toProspect(p, spec.type, nb.name);
          if (prospect && !byId.has(prospect.place_id)) {
            byId.set(prospect.place_id, prospect);
          }
        }
      } catch (e) {
        errors.push(`${spec.type} / ${nb.name}: ${(e as Error).message}`);
      }
    }
  }

  return { prospects: [...byId.values()], queriesRun, errors };
}

function toProspect(
  p: google.maps.places.Place,
  type: IcpType,
  neighborhood: Neighborhood,
): Prospect | null {
  if (!p.id || !p.location || !p.displayName) return null;
  if ((p.types ?? []).some((t) => TYPE_DENYLIST.has(t))) return null;
  // Drop closed businesses (permanently or temporarily) so the canvassing list
  // stays actionable; keep places with an unknown status.
  if (p.businessStatus && p.businessStatus !== google.maps.places.BusinessStatus.OPERATIONAL)
    return null;

  return {
    place_id: p.id,
    name: p.displayName,
    type,
    neighborhood,
    lat: p.location.lat(),
    lng: p.location.lng(),
    phone: p.nationalPhoneNumber ?? null,
    address: p.formattedAddress ?? null,
  };
}
