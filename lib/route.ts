// "Plan my walk" — order a set of prospects into an efficient visiting sequence.
// A greedy nearest-neighbour heuristic (start at the user, always hop to the
// closest unvisited point) — not optimal TSP, but simple, fast, deterministic,
// and good enough for a door-to-door walk. Pure + unit-tested.

import { distanceMeters, type LatLng } from './geo';

export interface RouteStop<T> {
  item: T;
  legMeters: number; // distance from the previous point (or origin) to here
  cumulativeMeters: number; // total distance walked up to and including this stop
}

export function planRoute<T extends LatLng>(
  origin: LatLng,
  points: readonly T[],
  maxStops = 20,
): RouteStop<T>[] {
  const remaining = [...points];
  const stops: RouteStop<T>[] = [];
  let current: LatLng = origin;
  let cumulative = 0;

  while (remaining.length > 0 && stops.length < maxStops) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceMeters(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    cumulative += bestDist;
    stops.push({ item: next, legMeters: bestDist, cumulativeMeters: cumulative });
    current = next;
  }

  return stops;
}
