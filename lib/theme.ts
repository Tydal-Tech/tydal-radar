import { createTheme } from '@mui/material/styles';

// Tydal Radar brand: navy surfaces, blue primary actions, cyan accents.
// Apple-Maps-style dark, frosted-glass aesthetic — translucent blurred surfaces
// (driven by the MuiPaper override) over a dark map, with high-contrast type.
// Roboto via the CSS variable wired up in app/layout.tsx.
const FROST = 'blur(24px) saturate(180%)';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2563eb' }, // blue — primary actions
    secondary: { main: '#06b6d4' }, // cyan — accents only
    background: { default: '#0b0f1a', paper: 'rgba(22,27,45,0.80)' },
    text: { primary: '#f5f7fa', secondary: 'rgba(255,255,255,0.72)' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'var(--font-roboto), Roboto, -apple-system, "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    // Every surface (search bar, bottom nav, follow-up cards, prospect sheet)
    // becomes frosted glass: translucent navy fill (background.paper) + blur.
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none', // drop MUI's dark elevation overlay
          backdropFilter: FROST,
          WebkitBackdropFilter: FROST,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
        // Bigger tap targets on default chips; small chips (Follow-ups) untouched.
        sizeMedium: { height: 36, fontSize: '0.9rem' },
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
