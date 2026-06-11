import { createTheme } from '@mui/material/styles';
import { GLASS_BLUR } from './glass';

// Tydal Radar brand: navy surfaces, blue primary actions, cyan accents.
// iOS 18-style dark glass aesthetic — luminous translucent surfaces (driven by
// the MuiPaper blur override + the shared glass styles in lib/glass.ts) over a
// dark map, with high-contrast type. Roboto via the CSS variable in layout.tsx.

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2563eb' }, // blue — primary actions
    secondary: { main: '#06b6d4' }, // cyan — accents only
    // Lighter, luminous frost so the map shows through with a glow rather than
    // reading as a near-solid dark panel.
    background: { default: '#0b0f1a', paper: 'rgba(34,40,62,0.58)' },
    text: { primary: '#f5f7fa', secondary: 'rgba(255,255,255,0.78)' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'var(--font-roboto), Roboto, -apple-system, "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    // Every surface (search bar, floating nav, follow-up cards, prospect sheet)
    // becomes frosted glass: translucent navy fill (background.paper) + blur.
    // Hero surfaces add the inset highlight + shadow via the shared glassSx.
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none', // drop MUI's dark elevation overlay
          backdropFilter: GLASS_BLUR,
          WebkitBackdropFilter: GLASS_BLUR,
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
    // Brief pressed-state feedback on the floating circular controls.
    MuiFab: {
      styleOverrides: {
        root: {
          transition: 'transform 150ms cubic-bezier(0.2, 0, 0.2, 1)',
          '&:active': { transform: 'scale(0.92)' },
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
