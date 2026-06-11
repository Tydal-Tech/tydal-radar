// Pipeline stages, their display labels, and the brand colors used for pins,
// badges, and chips throughout the app. Single source of truth.

export type Stage =
  | 'not_knocked'
  | 'knocked'
  | 'talked'
  | 'follow_up'
  | 'client'
  | 'not_interested';

export const STAGES: Stage[] = [
  'not_knocked',
  'knocked',
  'talked',
  'follow_up',
  'client',
  'not_interested',
];

export const STAGE_LABELS: Record<Stage, string> = {
  not_knocked: 'Not knocked',
  knocked: 'Knocked',
  talked: 'Talked',
  follow_up: 'Follow-up',
  client: 'Client',
  not_interested: 'Not interested',
};

export const STAGE_COLORS: Record<Stage, string> = {
  // Dark slate (was a light grey) so the white pin glyph stays legible and the
  // most-common stage reads as a quiet backdrop while active stages pop.
  not_knocked: '#5b6470',
  knocked: '#f9ab00',
  talked: '#1a73e8',
  follow_up: '#06b6d4',
  client: '#1e8e3e',
  not_interested: '#5f6368',
};

// Text color that reads well on top of each stage color (for badges/glyphs).
export const STAGE_ON_COLOR: Record<Stage, string> = {
  not_knocked: '#ffffff',
  knocked: '#1a1f36',
  talked: '#ffffff',
  follow_up: '#0b3b44',
  client: '#ffffff',
  not_interested: '#ffffff',
};
