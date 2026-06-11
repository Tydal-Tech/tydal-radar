'use client';

import { useState } from 'react';
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
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useData } from './DataProvider';
import SheetShell from './SheetShell';
import { ICP } from '@/lib/icp';
import { STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR } from '@/lib/stages';
import { glassCardSx } from '@/lib/glass';
import type { IcpType } from '@/lib/types';

// Search as a bottom sheet OVER the map (Apple Maps pattern), built on the same
// three-detent SheetShell as Follow-ups and Contracts so all three cards share
// IDENTICAL stage heights. The search field + Cancel render as the shell's
// fixed header (above the scrolling results). The field stays visible above
// the iOS keyboard because the whole app shell resizes to the visual viewport
// and SheetShell's detents recompute from it — no per-sheet keyboard lift.
// Tapping/scrolling outside the field dismisses the keyboard; tapping a result
// selects the prospect and returns to the map.
export default function SearchOverlay({
  onClose,
  onScroll,
}: {
  onClose: () => void;
  onScroll?: () => void;
}) {
  const { views, setSelectedId } = useData();
  const [query, setQuery] = useState('');

  // Drop the keyboard (used on outside taps / scroll).
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
    <SheetShell
      onClose={onClose}
      initialDetent="half"
      onScroll={() => {
        onScroll?.();
        blurKeyboard();
      }}
      header={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pb: 1 }}>
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
      }
    >
      {/* Results — tapping/scrolling here dismisses the keyboard. */}
      <Box onPointerDown={blurKeyboard} sx={{ px: 1.5, pb: 2 }}>
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
    </SheetShell>
  );
}
