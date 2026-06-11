import { createTheme } from '@mui/material/styles';
import { PRESS_EASE, PRESS_MS, STANDARD_EASE, STATE_MS } from './motion';

// Shared transition recipes for interactive controls. Transform rides the
// snappy overshoot ease (spring-like press/release); color/state properties
// ride the standard iOS ease so selected/disabled/hover changes glide instead
// of snapping. Transform + paint properties only — never layout, no map jank.
const PRESS_TRANSFORM = `transform ${PRESS_MS}ms ${PRESS_EASE}`;
const STATE_TRANSITION = [
  PRESS_TRANSFORM,
  `background-color ${STATE_MS}ms ${STANDARD_EASE}`,
  `color ${STATE_MS}ms ${STANDARD_EASE}`,
  `box-shadow ${STATE_MS}ms ${STANDARD_EASE}`,
  `border-color ${STATE_MS}ms ${STANDARD_EASE}`,
].join(', ');

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
    // Global press feedback: every ButtonBase-derived control (Button,
    // IconButton, Fab, clickable Chip, CardActionArea, BottomNavigationAction,
    // ListItemButton, Tab, MenuItem, ToggleButton, Switch/Checkbox/Radio
    // touch targets…) compresses slightly under the finger and springs back
    // with a hint of overshoot — the iOS "alive" feel. Transform-only.
    MuiButtonBase: {
      styleOverrides: {
        root: {
          transition: PRESS_TRANSFORM,
          '&:active': { transform: 'scale(0.95)' },
        },
      },
    },
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
    // Buttons: spring-back press + eased state/color changes (e.g. variant or
    // disabled toggles glide instead of snapping).
    MuiButton: {
      styleOverrides: {
        root: {
          transition: STATE_TRANSITION,
          '&:active': { transform: 'scale(0.96)' },
        },
      },
    },
    // Icon buttons are small targets — a slightly deeper press (0.92) reads
    // clearly at thumb scale without ever feeling bouncy.
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: STATE_TRANSITION,
          '&:active': { transform: 'scale(0.92)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          // Subtle tap feedback (scale, overshoot ease) + smooth selected-state
          // color change. Transform/color only — paint, never layout, so no
          // map jank.
          transition: STATE_TRANSITION,
          '&:active': { transform: 'scale(0.95)' },
        },
        // Bigger tap targets on default chips; small chips (Follow-ups) untouched.
        sizeMedium: { height: 36, fontSize: '0.9rem' },
      },
    },
    // Press feedback on the floating circular controls: scale down ~0.96 then
    // spring back (overshoot easing); shadow/color changes ease alongside.
    MuiFab: {
      styleOverrides: {
        root: {
          transition: STATE_TRANSITION,
          '&:active': { transform: 'scale(0.96)' },
        },
      },
    },
    // Large tappable card surfaces: a gentler press (0.98) — a full 0.95 on a
    // wide card reads as a wobble, 0.98 reads as premium.
    MuiCardActionArea: {
      styleOverrides: {
        root: {
          transition: STATE_TRANSITION,
          '&:active': { transform: 'scale(0.98)' },
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
