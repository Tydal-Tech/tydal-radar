// Uber-Driver-style flat-dark material. Presentation only — shared so every
// floating surface (bottom bar, map control buttons, filter panel, search
// field, list cards) reads as the same solid near-black surface: an opaque
// dark fill, a hairline border, and a soft drop shadow. No blur, no sheen —
// high-contrast and glanceable over the dark map.
export const GLASS_BLUR = 'none';

// Hero surfaces (bottom bar, map control buttons, filter panel, search field):
// solid near-black with a faint hairline edge and a soft drop shadow.
export const glassSx = {
  backgroundColor: '#1c1d21',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
} as const;

// Small dark pill (status chips).
export const glassChipSx = {
  backgroundColor: 'rgba(20,21,24,0.92)',
} as const;

// List-row cards (Follow-ups / Contracts / Search): solid dark card with a
// hairline border and a press-scale.
export const glassCardSx = {
  borderRadius: 3,
  backgroundColor: '#1c1d21',
  border: '1px solid rgba(255,255,255,0.07)',
  transition: 'transform 180ms cubic-bezier(0.34, 1.45, 0.5, 1)',
  '&:active': { transform: 'scale(0.985)' },
} as const;
