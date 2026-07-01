// Same-type corridor: other UNWORKED prospects of the same ICP type within a
// short radius — a cluster you can pitch in one efficient loop ("dental row").
// Pure + unit-tested.

import type { ProspectView } from './types';
import { distanceMeters } from './geo';

export const CORRIDOR_RADIUS_M = 400;

export function sameTypeNearby(
  view: ProspectView,
  all: ProspectView[],
  radiusM: number = CORRIDOR_RADIUS_M,
): ProspectView[] {
  return all
    .filter(
      (v) =>
        v.place_id !== view.place_id &&
        v.type === view.type &&
        v.stage === 'not_knocked' &&
        distanceMeters(view, v) <= radiusM,
    )
    .sort((a, b) => distanceMeters(view, a) - distanceMeters(view, b));
}
