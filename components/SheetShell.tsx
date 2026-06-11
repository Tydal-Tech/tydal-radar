'use client';

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { motion, useDragControls } from 'framer-motion';

// Reusable pull-up bottom sheet — the same concept as the prospect card / search:
// slides up from above the nav bar over the dimmed map, drag the grabber down to
// close, content scrolls inside. Used by Follow-ups and Contracts.
export default function SheetShell({
  onClose,
  onScroll,
  heightFraction = 0.86,
  children,
}: {
  onClose: () => void;
  onScroll?: () => void;
  heightFraction?: number;
  children: ReactNode;
}) {
  const dragControls = useDragControls();
  const blur = () => (document.activeElement as HTMLElement | null)?.blur?.();

  return (
    <motion.div
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragSnapToOrigin
      dragConstraints={{ top: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 90 || info.velocity.y > 600) onClose();
      }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 'var(--nav-total)',
        height: `calc(100dvh * ${heightFraction})`,
        maxHeight: 'calc(100dvh - var(--nav-total))',
        background: '#1a1a1a',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        boxShadow: '0 -8px 30px rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1100,
      }}
    >
      {/* Grabber = drag handle (drag the sheet down to close). */}
      <Box
        onPointerDown={(e) => {
          blur();
          dragControls.start(e);
        }}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          py: 1.25,
          flexShrink: 0,
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <Box sx={{ width: 40, height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.25)' }} />
      </Box>
      <Box onScroll={onScroll} sx={{ flex: 1, overflowY: 'auto', touchAction: 'pan-y' }}>
        {children}
      </Box>
    </motion.div>
  );
}
