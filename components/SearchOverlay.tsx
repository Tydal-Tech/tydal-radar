'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  InputBase,
  IconButton,
  Button,
  Typography,
  Card,
  CardActionArea,
  Chip,
  Stack,
} from '@mui/material';
import { motion, useDragControls } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useData } from './DataProvider';
import { ICP } from '@/lib/icp';
import { STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR } from '@/lib/stages';
import { glassCardSx } from '@/lib/glass';
import type { IcpType } from '@/lib/types';

// Search as a bottom sheet OVER the map (Apple Maps pattern): a search field + a
// scrolling results list, sliding up from the bottom (above the nav bar) while
// the map stays visible (dimmed) behind it. Draggable down to close; tapping
// anywhere outside the field (the dimmed map, or the results) dismisses the
// keyboard. Same name/address match as before; tapping a result selects the
// prospect and returns to the map (where its sheet opens and the map recenters).
export default function SearchOverlay({
  onClose,
  onScroll,
}: {
  onClose: () => void;
  onScroll?: () => void;
}) {
  const { views, setSelectedId } = useData();
  const [query, setQuery] = useState('');
  const dragControls = useDragControls();

  // The keyboard overlays the page (viewport interactive-widget=overlays-content),
  // so the app stays static; measure the keyboard height from the visual viewport
  // and lift ONLY this sheet above it so the field stays visible.
  const [kbInset, setKbInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () =>
      setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  // Drop the keyboard (used on outside taps / scroll / drag).
  const blurKeyboard = () => (document.activeElement as HTMLElement | null)?.blur?.();

  const q = query.trim().toLowerCase();
  const results = q
    ? views.filter(
        (v) =>
          v.name.toLowerCase().includes(q) || (v.address ?? '').toLowerCase().includes(q),
      )
    : [];

  function openProspect(placeId: string) {
    setSelectedId(placeId);
    onClose();
  }

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
        bottom: kbInset > 0 ? `${kbInset}px` : 'var(--nav-total)',
        height: 'calc(var(--app-height) * 0.55)',
        transition: 'bottom 0.25s ease',
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
          blurKeyboard();
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

      {/* Search field + Cancel */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pb: 1, flexShrink: 0 }}>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 2.5,
            bgcolor: 'rgba(255,255,255,0.08)',
          }}
        >
          <SearchIcon sx={{ color: 'text.secondary' }} />
          <InputBase
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prospects"
            sx={{ flex: 1, fontSize: 16, ml: 0.5 }}
            inputProps={{ 'aria-label': 'Search prospects' }}
          />
          {query && (
            <IconButton size="small" aria-label="Clear" onClick={() => setQuery('')}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
        <Button onClick={onClose} sx={{ color: 'primary.main', minWidth: 0, px: 1 }}>
          Cancel
        </Button>
      </Box>

      {/* Results — tapping/scrolling here dismisses the keyboard. */}
      <Box
        onPointerDown={blurKeyboard}
        onScroll={() => {
          onScroll?.();
          blurKeyboard();
        }}
        sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 2, touchAction: 'pan-y' }}
      >
        {!q ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 4, px: 3 }}>
            <SearchIcon sx={{ fontSize: 44, opacity: 0.5 }} />
            <Typography sx={{ mt: 1 }}>Search prospects by name or address</Typography>
          </Box>
        ) : results.length === 0 ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 4, px: 3 }}>
            <Typography>No matches for “{query.trim()}”</Typography>
          </Box>
        ) : (
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            {results.map((v) => (
              <Card key={v.place_id} sx={glassCardSx}>
                <CardActionArea onClick={() => openProspect(v.place_id)} sx={{ p: 1.75 }}>
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>
                        {v.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {ICP[v.type as IcpType].label} · {v.neighborhood}
                      </Typography>
                      {v.address && (
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {v.address}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      size="small"
                      label={STAGE_LABELS[v.stage]}
                      sx={{
                        alignSelf: 'flex-start',
                        bgcolor: STAGE_COLORS[v.stage],
                        color: STAGE_ON_COLOR[v.stage],
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    />
                  </Stack>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </motion.div>
  );
}
