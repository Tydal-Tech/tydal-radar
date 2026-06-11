// Motion system tuned for iPhone 17 Pro Max (A19 Pro, 120Hz ProMotion, ~440pt).
//
// The hero interactions (bottom sheet open/close, sliding stage selector, nav
// active indicator) use physics springs via framer-motion. Springs run on
// requestAnimationFrame, so they render at the display's native refresh rate —
// full 120Hz on ProMotion, gracefully 60Hz on older devices — no device branch
// needed (and iOS Safari exposes no chip/RAM signal anyway). prefers-reduced-
// motion / reduced-transparency provide the accessibility fallbacks.

// 120Hz-aware spring, slightly snappier than the A17 baseline. For small,
// decisive elements (selector indicator, nav, control press).
export const SPRING_120 = { type: 'spring' as const, stiffness: 350, damping: 26, mass: 1 };

// Same family with a touch more body, for the large bottom-sheet surface so it
// settles with a slight overshoot rather than a hard snap.
export const SPRING_SHEET = { type: 'spring' as const, stiffness: 320, damping: 30, mass: 1 };

// Lightweight CSS path (press micro-interactions / degradation): an overshoot
// cubic-bezier approximating the spring, kept short so it feels A19-snappy.
export const PRESS_EASE = 'cubic-bezier(0.34, 1.45, 0.5, 1)';
export const PRESS_MS = 190;
