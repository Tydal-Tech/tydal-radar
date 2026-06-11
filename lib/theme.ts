import { createTheme } from '@mui/material/styles';
import { PRESS_EASE, PRESS_MS } from './motion';

// Tydal Radar brand: dark surfaces, blue primary actions, cyan accents.
// Uber-Driver-style flat-dark aesthetic — solid near-black surfaces (driven by
// the shared surface styles in lib/glass.ts) over a dark map, with
// high-contrast type. Montserrat via the CSS variable in layout.tsx.

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#5870E6' }, // accent blue
    secondary: { main: '#06b6d4' }, // cyan — accents only
    // Solid black + neutral near-black surfaces: opaque, flat, high-contrast —
    // no blur, no navy tint.
    background: { default: '#0F0F0F', paper: '#1a1a1a' },
    text: { primary: '#FFFFFF', secondary: '#A6A6A6' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'var(--font-montserrat), "Montserrat", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    // Every surface (bottom bar, map controls, follow-up cards, prospect sheet)
    // is a solid near-black panel: opaque background.paper, no blur, no MUI
    // elevation overlay. Hero surfaces add the hairline + shadow via glassSx.
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none', // drop MUI's dark elevation overlay
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          // Subtle tap feedback (scale) + smooth selected-state color change.
          // Transform/color only — paint, never layout, so no map jank.
          transition:
            'transform 150ms cubic-bezier(0.2, 0, 0.2, 1), background-color 180ms ease, border-color 180ms ease, color 180ms ease',
          '&:active': { transform: 'scale(0.95)' },
        },
        // Bigger tap targets on default chips; small chips (Follow-ups) untouched.
        sizeMedium: { height: 36, fontSize: '0.9rem' },
      },
    },
    // Press feedback on the floating circular controls: scale down ~0.96 then
    // spring back (overshoot easing).
    MuiFab: {
      styleOverrides: {
        root: {
          transition: `transform ${PRESS_MS}ms ${PRESS_EASE}`,
          '&:active': { transform: 'scale(0.96)' },
        },
      },
    },
    // Larger, higher-contrast form fields for arm's-length legibility.
    MuiInputBase: { styleOverrides: { input: { fontSize: '1.0625rem' } } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: '1.0625rem' } } },
    MuiOutlinedInput: {
      styleOverrides: { notchedOutline: { borderColor: 'rgba(255,255,255,0.28)' } },
    },
  },
});

export default theme;
