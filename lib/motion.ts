// Motion system tuned for iPhone 17 Pro Max (A19 Pro, 120Hz ProMotion, ~440pt).
//
// The hero interactions (bottom sheet open/close, sliding stage selector, nav
// active indicator) use physics springs via framer-motion. Springs run on
// requestAnimationFrame, so they render at the display's native refresh rate —
// full 120Hz on ProMotion, gracefully 60Hz on older devices — no device branch
// needed (and iOS Safari exposes no chip/RAM signal anyway). prefers-reduced-
// motion / reduced-transparency provide the accessibility fallbacks.

// 120Hz-aware spring, slightly snappier than the A17 baseline. For small,
// decisive elements (selector indicator, nav, control press). Damping 28 keeps
// a hint of overshoot without visible wobble at 120 fps.
export const SPRING_120 = { type: 'spring' as const, stiffness: 350, damping: 28, mass: 1 };

// Same family with a touch more body, for the large bottom-sheet surface so it
// settles with a slight overshoot rather than a hard snap.
export const SPRING_SHEET = { type: 'spring' as const, stiffness: 320, damping: 30, mass: 1 };

// Lightweight CSS path (press micro-interactions / degradation): an overshoot
// cubic-bezier approximating the spring, kept short so it feels A19-snappy.
// Use for transform on press/release of any tappable control.
export const PRESS_EASE = 'cubic-bezier(0.34, 1.4, 0.5, 1)';
export const PRESS_MS = 190;

// Standard iOS-style ease-out for state changes (background-color, color,
// border-color, box-shadow, opacity): decisive start, soft landing, no bounce.
export const STANDARD_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const STATE_MS = 200;

// One-shot "turned on / became active" pop (pairs with the .tydal-pop class in
// globals.css). Transform-only, so it's GPU-composited and map-safe.
export const POP_EASE = PRESS_EASE;
export const POP_MS = 320;
