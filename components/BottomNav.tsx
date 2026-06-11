'use client';

import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import SearchIcon from '@mui/icons-material/Search';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { PRESS_EASE, PRESS_MS } from '@/lib/motion';

export type Tab = 'map' | 'search' | 'followups' | 'contracts';

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
    // Uber-style solid dark bar: full-bleed width, square corners, a subtle top
    // hairline. Floats just above Google's attribution strip (--ui-bottom keeps
    // the logo/"Map data" line visible below it). Search lives here as an icon
    // (social-media pattern), not a standing bar. Condenses (labels collapse,
    // bar shrinks) while a list scrolls.
    <Paper
      elevation={0}
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 'var(--ui-bottom)',
        zIndex: 1200,
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: '#161719',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.45)',
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
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            color: 'rgba(255,255,255,0.6)',
            transition: `color 250ms ease, transform ${PRESS_MS}ms ${PRESS_EASE}`,
            '&:active': { transform: 'scale(0.94)' },
            '&.Mui-selected': { color: '#2563eb' },
          },
          '& .MuiBottomNavigationAction-label': {
            transition: 'opacity 200ms ease, max-height 240ms ease',
            opacity: condensed ? 0 : 1,
            maxHeight: condensed ? 0 : 20,
            overflow: 'hidden',
          },
        }}
      >
        <BottomNavigationAction label="Map" value="map" icon={<MapOutlinedIcon />} />
        <BottomNavigationAction label="Search" value="search" icon={<SearchIcon />} />
        <BottomNavigationAction
          label={followUpCount ? `Follow-ups (${followUpCount})` : 'Follow-ups'}
          value="followups"
          icon={<EventNoteOutlinedIcon />}
        />
        <BottomNavigationAction
          label="Contracts"
          value="contracts"
          icon={<CalendarMonthOutlinedIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
}
