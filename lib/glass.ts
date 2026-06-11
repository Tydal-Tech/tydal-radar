// iOS 18-style frosted-glass material. Presentation only — shared so every
// surface (search bar, filter chips, floating nav, sheet, FAB) reads as the
// same luminous glass: bright backdrop blur, a 1px inset top highlight, a
// hairline edge, and a soft outer shadow. Translucent fill comes from the
// theme's `background.paper`; the blur composites the dark map behind it.
export const GLASS_BLUR = 'blur(30px) saturate(190%)';

// Hero surfaces (search bar, floating nav, My-location FAB).
export const glassSx = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 12px 34px rgba(0,0,0,0.40)',
} as const;

// Chips: same glass, but no border (chips keep their own outline / stage color)
// and a lighter shadow so the little pills don't read as heavy slabs.
export const glassChipSx = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 14px rgba(0,0,0,0.30)',
} as const;
