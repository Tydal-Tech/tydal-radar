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
// "Straight glass": a light, clear blur — not a heavy frost — and NO saturate
// (saturate boosts the backdrop's color and reads as a tint). The fill is neutral
// grey, so there's no color cast; the glass look comes from the light blur + the
// white edge highlights, consistent whether the map is moving or still.
export const GLASS_BLUR = 'blur(5px)';

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
  'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 34%, rgba(255,255,255,0) 62%)';

// Hero surfaces (floating nav, map control buttons, filter panel, search field).
export const glassSx = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  backgroundImage: SPECULAR,
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow:
    'inset 0 1px 0.5px rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.08), inset 0 0 0 0.5px rgba(255,255,255,0.06), 0 14px 40px rgba(0,0,0,0.5)',
  ...REDUCED_TRANSPARENCY,
} as const;

// Chips: same glass, but no border (chips keep their own outline / stage color)
// and a lighter shadow so the little pills don't read as heavy slabs.
export const glassChipSx = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  backgroundImage: SPECULAR,
  boxShadow:
    'inset 0 1px 0.5px rgba(255,255,255,0.4), inset 0 -1px 0 rgba(255,255,255,0.08), 0 4px 14px rgba(0,0,0,0.30)',
  ...REDUCED_TRANSPARENCY,
} as const;

// List-row cards (Follow-ups / Contracts / Search): a faint translucent fill +
// sheen + hairline over the solid dark list background, with a press-scale.
export const glassCardSx = {
  borderRadius: 3,
  bgcolor: 'rgba(255,255,255,0.045)',
  backgroundImage: SPECULAR,
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.10)',
  transition: 'transform 180ms cubic-bezier(0.34, 1.45, 0.5, 1)',
  '&:active': { transform: 'scale(0.985)' },
  ...REDUCED_TRANSPARENCY,
} as const;
