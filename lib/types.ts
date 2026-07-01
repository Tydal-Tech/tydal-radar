import type { Stage } from './stages';

export type IcpType = 'daycare' | 'dental' | 'gym' | 'office' | 'veterinary' | 'medical';

export type Neighborhood =
  | 'Ville-Marie'
  | 'Shaughnessy Village'
  | 'Plateau-Mont-Royal'
  | 'Côte-des-Neiges–NDG';

/** Row in the `prospects` table (cached Google Places result). */
export interface Prospect {
  place_id: string;
  name: string;
  type: IcpType;
  neighborhood: string;
  lat: number;
  lng: number;
  phone: string | null;
  address: string | null;
  // Enrichment from Places (populated on scrape/Refresh; null on older rows).
  rating: number | null;
  user_rating_count: number | null;
  website: string | null;
  // Set by the DB default the first time a row is inserted (see the first_seen
  // migration). Null on rows that predate the column — those aren't "new".
  first_seen?: string | null;
}

/** Row in the `pipeline` table (per-prospect sales state). */
export interface Pipeline {
  place_id: string;
  stage: Stage;
  note: string | null;
  contact_name: string | null;
  current_provider: string | null;
  contract_expiry: string | null;
  follow_up_date: string | null; // YYYY-MM-DD
  lost_reason: string | null;
  stage_updated_at: string | null; // ISO; bumped only when the stage changes
  updated_at?: string;
}

/** A prospect merged with its pipeline state — what the UI renders. */
export interface ProspectView extends Prospect {
  stage: Stage;
  note: string | null;
  contact_name: string | null;
  current_provider: string | null;
  contract_expiry: string | null;
  follow_up_date: string | null;
  lost_reason: string | null;
  stage_updated_at: string | null;
}
