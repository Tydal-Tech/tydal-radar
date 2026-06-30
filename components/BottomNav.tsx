'use client';

import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import SearchIcon from '@mui/icons-material/Search';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { PRESS_EASE, PRESS_MS } from '@/lib/motion';

// 'analytics' is a valid app tab (the Stats sheet) but has NO bottom-nav action —
// it's opened from the floating Stats bubble over the map. value='analytics'
// simply leaves every nav action unselected.
export type Tab = 'map' | 'search' | 'followups' | 'contracts' | 'analytics';

export default function BottomNav({
  value,
  onChange,
  followUpCount,
  condensed = false,
}: {
  value: Tab;
  onChange: (tab: Tab) => void;
  followUpCount?: number;
  condensed?: boolean;
}) {
  return (
    // Uber-style solid dark bar: full-bleed, flush to the bottom edge (fills the
    // home-indicator area via the safe-area pad). It's the last flex item in the
    // shell column and takes its natural height; the map area flexes to meet its
    // top, so Google's attribution stays visible just above it. Condenses (labels
    // collapse, bar shrinks) while a list scrolls — the map re-flexes to match.
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        flexShrink: 0,
        zIndex: 1200,
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: '#141414',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.45)',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      <BottomNavigation
        value={value}
        onChange={(_, v: Tab) => onChange(v)}
        showLabels
        sx={{
          bgcolor: 'transparent',
          height: condensed ? 46 : 60,
          transition: 'height 280ms cubic-bezier(0.22, 1, 0.36, 1)',
          // Only the ICON lights up on selection — the action box and label
          // stay muted (no ripple/box highlight; disableRipple on the actions).
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            color: 'rgba(255,255,255,0.6)',
            transition: `transform ${PRESS_MS}ms ${PRESS_EASE}`,
            '&:active': { transform: 'scale(0.94)' },
            // Keep the action (and thus the label) muted even when selected.
            '&.Mui-selected': { color: 'rgba(255,255,255,0.6)' },
            '& .MuiSvgIcon-root': {
              transition:
                'transform 220ms cubic-bezier(0.34,1.4,0.5,1), filter 200ms ease, color 200ms ease',
              transform: 'scale(1)',
              filter: 'none',
            },
            // Selected: the icon turns white, scales up with a slight
            // overshoot, and gets a soft "lit" glow.
            '&.Mui-selected .MuiSvgIcon-root': {
              color: '#FFFFFF',
              transform: 'scale(1.12)',
              filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.55))',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            transition: 'opacity 200ms ease, max-height 240ms ease',
            opacity: condensed ? 0 : 1,
            maxHeight: condensed ? 0 : 20,
            overflow: 'hidden',
          },
        }}
      >
        <BottomNavigationAction disableRipple label="Map" value="map" icon={<MapOutlinedIcon />} />
        <BottomNavigationAction
          disableRipple
          label="Search"
          value="search"
          icon={<SearchIcon />}
        />
        <BottomNavigationAction
          disableRipple
          label={followUpCount ? `Follow-ups (${followUpCount})` : 'Follow-ups'}
          value="followups"
          icon={<EventNoteOutlinedIcon />}
        />
        <BottomNavigationAction
          disableRipple
          label="Contracts"
          value="contracts"
          icon={<CalendarMonthOutlinedIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
}
