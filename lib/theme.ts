import { createTheme } from '@mui/material/styles';

// Tydal Radar brand: navy text/surfaces, blue primary actions, cyan accents.
// Roboto via the CSS variable wired up in app/layout.tsx.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563eb' }, // blue — primary actions
    secondary: { main: '#06b6d4' }, // cyan — accents only
    background: { default: '#eef0f3', paper: '#ffffff' },
    text: { primary: '#1a1f36', secondary: '#5f6368' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'var(--font-roboto), Roboto, -apple-system, "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
  },
});

export default theme;
