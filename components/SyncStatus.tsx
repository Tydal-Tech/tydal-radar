'use client';

import { Box, CircularProgress } from '@mui/material';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloudQueueRoundedIcon from '@mui/icons-material/CloudQueueRounded';

// Small top-left status pill that surfaces offline / pending-sync / syncing
// state (from DataProvider's outbox). Renders nothing when online, idle, and
// fully synced — no clutter in the common case. Pure/presentational so it's
// unit-testable; MapView feeds it the live values.
export default function SyncStatus({
  online,
  pending,
  syncing,
}: {
  online: boolean;
  pending: number;
  syncing: boolean;
}) {
  if (online && !syncing && pending === 0) return null;

  let icon: React.ReactNode;
  let label: string;
  if (!online) {
    icon = <CloudOffRoundedIcon sx={{ fontSize: 16 }} />;
    label = pending > 0 ? `Offline · ${pending} to sync` : 'Offline';
  } else if (syncing) {
    icon = <CircularProgress size={13} thickness={6} sx={{ color: 'inherit' }} />;
    label = 'Syncing…';
  } else {
    icon = <CloudQueueRoundedIcon sx={{ fontSize: 16 }} />;
    label = `${pending} to sync`;
  }

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: 'absolute',
        top: 'calc(var(--safe-top) + 12px)',
        left: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.5,
        py: 0.75,
        borderRadius: 99,
        bgcolor: online ? 'rgba(20,20,20,0.72)' : 'rgba(140,58,58,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
        color: '#fff',
        fontSize: '0.85rem',
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {icon}
      {label}
    </Box>
  );
}
