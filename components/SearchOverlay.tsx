'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  InputBase,
  IconButton,
  Typography,
  Card,
  CardActionArea,
  Chip,
  Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useData } from './DataProvider';
import { ICP } from '@/lib/icp';
import { STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR } from '@/lib/stages';
import { glassSx, glassCardSx } from '@/lib/glass';
import type { IcpType } from '@/lib/types';

// Full-screen search (the social-media pattern): a frosted field + a results
// list, reached from the Search nav tab instead of a standing bar. Same
// name/address match the old bar used; tapping a result selects the prospect
// and returns to the map (where the sheet opens and the map recenters).
export default function SearchOverlay({
  onClose,
  onScroll,
}: {
  onClose: () => void;
  onScroll?: () => void;
}) {
  const { views, setSelectedId } = useData();
  const [query, setQuery] = useState('');

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
    <Box
      onScroll={onScroll}
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: 'background.default',
        overflowY: 'auto',
        pt: 'calc(var(--safe-top) + 8px)',
        px: 1.5,
        pb: 'calc(var(--ui-bottom) + 80px)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pl: 0.5,
          pr: 1,
          py: 0.5,
          borderRadius: 999,
          ...glassSx,
        }}
      >
        <IconButton aria-label="Close search" onClick={onClose}>
          <ArrowBackIcon />
        </IconButton>
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
      </Paper>

      {!q ? (
        <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 8, px: 3 }}>
          <SearchIcon sx={{ fontSize: 48, opacity: 0.5 }} />
          <Typography sx={{ mt: 1 }}>Search prospects by name or address</Typography>
        </Box>
      ) : results.length === 0 ? (
        <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 8, px: 3 }}>
          <Typography>No matches for “{query.trim()}”</Typography>
        </Box>
      ) : (
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
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
  );
}
