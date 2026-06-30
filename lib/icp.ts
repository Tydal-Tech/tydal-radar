import type { IcpType, Neighborhood } from './types';

// Display metadata per ICP type. Search queries live in ICP_SEARCHES below —
// `office` is several searches merged, so it has no single query of its own.
export const ICP: Record<IcpType, { label: string }> = {
  daycare: { label: 'Daycare' },
  dental: { label: 'Dental' },
  gym: { label: 'Gym' },
  office: { label: 'Office' },
  veterinary: { label: 'Veterinary' },
};

export const ICP_TYPES = Object.keys(ICP) as IcpType[];

// Each entry is one Places text search, tagged with the `type` bucket it fills,
// using an `includedType` (a Places "Table A" type) to stay on-target. `office`
// is intentionally several searches (lawyer / accounting / real estate) merged
// into ONE bucket — no separate labels or subtypes — matching radar-grid-scrape.js.
export const ICP_SEARCHES: { type: IcpType; query: string; includedType: string }[] = [
  { type: 'daycare', query: 'garderie CPE daycare', includedType: 'child_care_agency' },
  { type: 'dental', query: 'dental clinic dentist', includedType: 'dentist' },
  { type: 'gym', query: 'gym fitness studio', includedType: 'gym' },
  { type: 'veterinary', query: 'veterinary clinic vet animal hospital', includedType: 'veterinary_care' },
  { type: 'office', query: 'law firm lawyer attorney', includedType: 'lawyer' },
  { type: 'office', query: 'accounting firm accountant CPA', includedType: 'accounting' },
  { type: 'office', query: 'real estate agency realtor broker', includedType: 'real_estate_agency' },
];

// Vertical glyph per ICP type (same set the map pins use), for list rows.
export const ICP_EMOJI: Record<IcpType, string> = {
  daycare: '🧸',
  dental: '🦷',
  gym: '🏋️',
  office: '🏢',
  veterinary: '🐾',
};

// Approximate bounding boxes for each target Montreal neighborhood. Used as the
// Places `locationRestriction` so results stay tight to the area we canvass.
export const NEIGHBORHOODS: {
  name: Neighborhood;
  bounds: google.maps.LatLngBoundsLiteral;
}[] = [
  { name: 'Ville-Marie', bounds: { south: 45.494, west: -73.578, north: 45.516, east: -73.548 } },
  { name: 'Shaughnessy Village', bounds: { south: 45.489, west: -73.587, north: 45.501, east: -73.571 } },
  { name: 'Plateau-Mont-Royal', bounds: { south: 45.512, west: -73.598, north: 45.537, east: -73.564 } },
  { name: 'Côte-des-Neiges–NDG', bounds: { south: 45.458, west: -73.642, north: 45.502, east: -73.598 } },
];

// Places categories that are never an ICP match — drop them post-search.
export const TYPE_DENYLIST = new Set<string>([
  'supermarket',
  'grocery_store',
  'department_store',
  'shopping_mall',
  'gas_station',
  'car_dealer',
  'car_repair',
  'bank',
  'atm',
  'hospital',
  'university',
  'lodging',
  'hotel',
  'tourist_attraction',
  'park',
  'church',
  'place_of_worship',
]);

// Map center / default view for the map (downtown Montreal).
export const MAP_CENTER = { lat: 45.5019, lng: -73.5674 };
export const MAP_ZOOM = 13;
