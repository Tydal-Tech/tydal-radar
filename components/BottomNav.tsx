'use client';

import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import { glassSx } from '@/lib/glass';

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
    // Floating frosted pill detached from every edge, sitting over a full-bleed
    // map. Glass material matches the search bar; corners clipped to the pill.
    <Paper
      elevation={0}
      sx={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 'calc(var(--safe-bottom) + 12px)',
        zIndex: 1200,
        borderRadius: 999,
        overflow: 'hidden',
        ...glassSx,
      }}
    >
      <BottomNavigation
        value={value}
        onChange={(_, v: Tab) => onChange(v)}
        showLabels
        sx={{ bgcolor: 'transparent', height: 64 }}
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
