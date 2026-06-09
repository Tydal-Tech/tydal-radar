import type { IcpType, Neighborhood } from './types';

// Ideal Customer Profile: each type maps to a Places text query + an
// `includedType` (a Places "Table A" type) to keep results on-target.
export const ICP: Record<
  IcpType,
  { label: string; query: string; includedType: string }
> = {
  daycare: { label: 'Daycare', query: 'garderie CPE daycare', includedType: 'child_care_agency' },
  dental: { label: 'Dental', query: 'dental clinic dentist', includedType: 'dentist' },
  gym: { label: 'Gym', query: 'gym fitness studio', includedType: 'gym' },
  office: { label: 'Office / Clinic', query: 'medical clinic office', includedType: 'doctor' },
};

export const ICP_TYPES = Object.keys(ICP) as IcpType[];

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
