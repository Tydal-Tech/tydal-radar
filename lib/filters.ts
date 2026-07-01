// Prospect filter model + pure predicate, shared by the map (MapView) and the
// filter UI (FilterPanel). Kept out of the components so it's unit-testable and
// there's a single source of truth for "what counts as filtered".

import { isUrgent } from './contracts';
import type { Stage } from './stages';
import type { IcpType, ProspectView } from './types';

export interface Filters {
  nb: string | 'all';
  types: IcpType[]; // selected ICP types; empty = all types (multi-select)
  stage: Stage | 'all';
  attention: boolean; // only prospects with a due follow-up / expiring contract
}

export const EMPTY_FILTERS: Filters = {
  nb: 'all',
  types: [],
  stage: 'all',
  attention: false,
};

/** True when any filter narrows the set (drives the "Clear all" affordance). */
export function anyActiveFilter(f: Filters): boolean {
  return f.nb !== 'all' || f.types.length > 0 || f.stage !== 'all' || f.attention;
}

/** Whether a prospect passes the active filters (map + list share this). */
export function matchesFilters(v: ProspectView, f: Filters): boolean {
  return (
    (f.nb === 'all' || v.neighborhood === f.nb) &&
    (f.types.length === 0 || f.types.includes(v.type)) &&
    (f.stage === 'all' || v.stage === f.stage) &&
    (!f.attention || isUrgent(v))
  );
}
