// iOS 26 "Liquid Glass" material. Presentation only — shared so every floating
// surface (floating nav, map control buttons, filter panel, search field, sheet)
// reads as the same luminous glass: a strong backdrop blur + saturation boost, a
// faint specular gradient and inner top highlight, a hairline translucent border,
// and a soft diffuse shadow. Translucent fill comes from `background.paper`; the
// blur refracts the dark map behind it.
//
// Accessibility: under prefers-reduced-transparency the blur + sheen are dropped
// for a solid dark surface (applied via the nested media query so it follows the
// style wherever glassSx is spread).
export const GLASS_BLUR = 'blur(32px) saturate(200%)';

const REDUCED_TRANSPARENCY = {
  '@media (prefers-reduced-transparency: reduce)': {
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    backgroundImage: 'none',
    backgroundColor: '#171c2e',
  },
} as const;

// Faint top-down specular sheen layered over the translucent fill.
const SPECULAR =
  'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 38%, rgba(255,255,255,0) 100%)';

// Hero surfaces (floating nav, map control buttons, filter panel, search field).
export const glassSx = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  backgroundImage: SPECULAR,
  border: '1px solid rgba(255,255,255,0.16)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 0 0.5px rgba(255,255,255,0.05), 0 16px 42px rgba(0,0,0,0.44)',
  ...REDUCED_TRANSPARENCY,
} as const;

// Chips: same glass, but no border (chips keep their own outline / stage color)
// and a lighter shadow so the little pills don't read as heavy slabs.
export const glassChipSx = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  backgroundImage: SPECULAR,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 14px rgba(0,0,0,0.30)',
  ...REDUCED_TRANSPARENCY,
} as const;

// List-row cards (Follow-ups / Contracts / Search): a faint translucent fill +
// sheen + hairline over the solid dark list background, with a press-scale.
export const glassCardSx = {
  borderRadius: 3,
  bgcolor: 'rgba(255,255,255,0.045)',
  backgroundImage: SPECULAR,
  border: '1px solid rgba(255,255,255,0.1)',
  transition: 'transform 180ms cubic-bezier(0.34, 1.45, 0.5, 1)',
  '&:active': { transform: 'scale(0.985)' },
  ...REDUCED_TRANSPARENCY,
} as const;
