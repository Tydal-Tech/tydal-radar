'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useGeo } from './GeolocationProvider';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { underwrite, type ValueBand } from '@/lib/underwriting';
import type { IcpType, ProspectView } from '@/lib/types';

// How many top prospects to surface when the field is empty.
const TOP_N = 30;

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
  const { position } = useGeo();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field WITHOUT scrolling, after the sheet's entrance animation has
  // settled. `preventScroll: true` stops iOS from panning the page to reveal
  // the input, and the ~350ms delay lets the SheetShell spring slide-in finish
  // so focus happens on-screen (autoFocus would fire while the sheet is still
  // off-screen, making iOS compute a maximal reveal-scroll).
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
    return () => clearTimeout(t);
  }, []);

  // Drop the keyboard (used on outside taps / scroll).
  const blurKeyboard = () => (document.activeElement as HTMLElement | null)?.blur?.();

  const q = query.trim().toLowerCase();
  const matched = q
    ? views.filter(
        (v) =>
          v.name.toLowerCase().includes(q) || (v.address ?? '').toLowerCase().includes(q),
      )
    : [];
  // Nearest first when we have a GPS fix, so the closest matches are on top.
  const results = position
    ? [...matched].sort((a, b) => distanceMeters(position, a) - distanceMeters(position, b))
    : matched;

  // Empty-field state doubles as a "hot list": the doors with the highest
  // expected value per unit of effort (the underwriting engine), which folds in
  // win-probability, contract value, timing, confidence AND travel from your
  // current location. Drops won/dead rows (ev 0) so it's an action list.
  const topProspects = useMemo(() => {
    return views
      .map((v) => ({ v, uw: underwrite(v, position ?? undefined) }))
      .filter((r) => r.uw.ev > 0)
      .sort((a, b) => b.uw.ev - a.uw.ev)
      .slice(0, TOP_N);
  }, [views, position]);

  function openProspect(placeId: string) {
    setSelectedId(placeId);
    onClose();
  }

  const Row = ({ v, band }: { v: ProspectView; band?: ValueBand }) => (
    <Card key={v.place_id} sx={glassCardSx}>
      <CardActionArea onClick={() => openProspect(v.place_id)} sx={{ p: 1.75 }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }} noWrap>
              {v.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {ICP[v.type as IcpType].label} · {v.neighborhood}
              {position ? ` · ${formatDistance(distanceMeters(position, v))}` : ''}
            </Typography>
            {v.address && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {v.address}
              </Typography>
            )}
          </Box>
          <Stack spacing={0.5} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
            {band && (
              <Chip
                size="small"
                label={band}
                title="Estimated contract size (relative — larger businesses rank higher)"
                sx={{ bgcolor: 'transparent', border: '1px solid #34c759', color: '#34c759', fontWeight: 700 }}
              />
            )}
            <Chip
              size="small"
              label={STAGE_LABELS[v.stage]}
              sx={{
                bgcolor: STAGE_COLORS[v.stage],
                color: STAGE_ON_COLOR[v.stage],
                fontWeight: 600,
              }}
            />
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );

  return (
    <SheetShell
      onClose={onClose}
      ariaLabel="Search"
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
              inputRef={inputRef}
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
          topProspects.length === 0 ? (
            <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 4, px: 3 }}>
              <SearchIcon sx={{ fontSize: 44, opacity: 0.5 }} />
              <Typography sx={{ mt: 1 }}>Search prospects by name or address</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ px: 0.5, letterSpacing: 0.5 }}
              >
                Top prospects · work these next
              </Typography>
              {topProspects.map(({ v, uw }) => (
                <Row key={v.place_id} v={v} band={uw.valueBand} />
              ))}
            </Stack>
          )
        ) : results.length === 0 ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 4, px: 3 }}>
            <Typography>No matches for “{query.trim()}”</Typography>
          </Box>
        ) : (
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            {results.map((v) => (
              <Row key={v.place_id} v={v} />
            ))}
          </Stack>
        )}
      </Box>
    </SheetShell>
  );
}
