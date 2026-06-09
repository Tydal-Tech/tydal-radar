'use client';

import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';

export type Tab = 'map' | 'followups';

export default function BottomNav({
  value,
  onChange,
  followUpCount,
}: {
  value: Tab;
  onChange: (tab: Tab) => void;
  followUpCount?: number;
}) {
  return (
    <Paper
      square
      elevation={8}
      sx={{
        zIndex: 1200,
        borderTop: '1px solid #e0e0e0',
        pb: 'var(--safe-bottom)',
      }}
    >
      <BottomNavigation
        value={value}
        onChange={(_, v: Tab) => onChange(v)}
        showLabels
      >
        <BottomNavigationAction label="Map" value="map" icon={<MapOutlinedIcon />} />
        <BottomNavigationAction
          label={
            followUpCount ? `Follow-ups (${followUpCount})` : 'Follow-ups'
          }
          value="followups"
          icon={<EventNoteOutlinedIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
}
