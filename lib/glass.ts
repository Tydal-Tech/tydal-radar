// Uber-Driver-style flat-dark material. Presentation only — shared so every
// floating surface (bottom bar, map control buttons, filter panel, search
// field, list cards) reads as the same solid near-black surface: an opaque
// dark fill, a hairline border, and a soft drop shadow. No blur, no sheen —
// high-contrast and glanceable over the dark map.
export const GLASS_BLUR = 'none';

// Hero surfaces (bottom bar, map control buttons, filter panel, search field):
// solid near-black with a faint hairline edge and a soft drop shadow.
export const glassSx = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
} as const;

// Small dark pill (status chips).
export const glassChipSx = {
  backgroundColor: 'rgba(26,26,26,0.92)',
} as const;

// List-row cards (Follow-ups / Contracts / Search): solid dark card with a
// hairline border and a press-scale.
export const glassCardSx = {
  borderRadius: 3,
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.07)',
  transition: 'transform 180ms cubic-bezier(0.34, 1.45, 0.5, 1)',
  '&:active': { transform: 'scale(0.985)' },
} as const;

// Filled container surface for cards/sections (Analytics, list rows): a fill
// slightly lighter than the dark screen at a calm 16px radius and NO border —
// elevation comes from the fill alone, matching the prospect (Detail) sheet's
// surfaces (rgba(255,255,255,0.05)). Container cards only — buttons/chips/tags
// keep their pill shapes.
export const cardSurfaceSx = {
  borderRadius: '16px',
  backgroundColor: 'rgba(255,255,255,0.05)',
} as const;
