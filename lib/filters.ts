// Prospect filter model + pure predicate, shared by the map (MapView) and the
// filter UI (FilterPanel). Kept out of the components so it's unit-testable and
// there's a single source of truth for "what counts as filtered".

import { isUrgent } from './contracts';
import { distanceMeters, type LatLng } from './geo';
import type { Stage } from './stages';
import type { IcpType, ProspectView } from './types';

// "Near me" radius — a prospect counts as nearby within this many metres.
export const NEAR_RADIUS_M = 1000;

export interface Filters {
  nb: string | 'all';
  types: IcpType[]; // selected ICP types; empty = all types (multi-select)
  stage: Stage | 'all';
  attention: boolean; // only prospects with a due follow-up / expiring contract
  nearMe: boolean; // within NEAR_RADIUS_M of the user (needs a GPS fix)
}

export const EMPTY_FILTERS: Filters = {
  nb: 'all',
  types: [],
  stage: 'all',
  attention: false,
  nearMe: false,
};

/** True when any filter narrows the set (drives the "Clear all" affordance). */
export function anyActiveFilter(f: Filters): boolean {
  return f.nb !== 'all' || f.types.length > 0 || f.stage !== 'all' || f.attention || f.nearMe;
}

/** Whether a prospect passes the active filters (map + list share this).
 *  `origin` is the user's location for the "near me" filter; when it's absent
 *  (no GPS fix yet) the nearMe constraint is skipped rather than hiding all. */
export function matchesFilters(v: ProspectView, f: Filters, origin?: LatLng | null): boolean {
  return (
    (f.nb === 'all' || v.neighborhood === f.nb) &&
    (f.types.length === 0 || f.types.includes(v.type)) &&
    (f.stage === 'all' || v.stage === f.stage) &&
    (!f.attention || isUrgent(v)) &&
    (!f.nearMe || !origin || distanceMeters(origin, v) <= NEAR_RADIUS_M)
  );
}
