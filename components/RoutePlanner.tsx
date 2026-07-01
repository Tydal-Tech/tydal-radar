'use client';

import { useMemo } from 'react';
import { Box, Typography, Card, CardActionArea, Stack, Button } from '@mui/material';
import NearMeIcon from '@mui/icons-material/NearMe';
import { useData } from './DataProvider';
import { useGeo } from './GeolocationProvider';
import SheetShell from './SheetShell';
import { ICP } from '@/lib/icp';
import { formatDistance, distanceMeters } from '@/lib/geo';
import { planRoute } from '@/lib/route';
import { underwrite } from '@/lib/underwriting';
import { openDirections } from '@/lib/directions';
import { glassCardSx } from '@/lib/glass';
import type { IcpType } from '@/lib/types';

const MAX_STOPS = 15;
const RADIUS_M = 3000; // prefer doors within a walkable radius

// "Plan my walk": picks the highest expected-value unworked doors near you (the
// underwriting engine), then orders them into an efficient nearest-neighbour
// path — so you work the most valuable block, not just the closest one.
export default function RoutePlanner({
  onClose,
  onScroll,
}: {
  onClose: () => void;
  onScroll?: () => void;
}) {
  const { views, setSelectedId } = useData();
  const { position, enable } = useGeo();

  const stops = useMemo(() => {
    if (!position) return [];
    const unworked = views.filter((v) => v.stage === 'not_knocked');
    const withinRadius = unworked.filter((v) => distanceMeters(position, v) <= RADIUS_M);
    const pool = withinRadius.length ? withinRadius : unworked;
    // Rank by expected value, keep the best MAX_STOPS, then route them efficiently.
    const topByValue = pool
      .map((v) => ({ v, ev: underwrite(v, position).ev }))
      .sort((a, b) => b.ev - a.ev)
      .slice(0, MAX_STOPS)
      .map((r) => r.v);
    return planRoute(position, topByValue, MAX_STOPS);
  }, [views, position]);
  const total = stops.length ? stops[stops.length - 1].cumulativeMeters : 0;

  return (
    <SheetShell onClose={onClose} onScroll={onScroll} initialDetent="half" ariaLabel="Route">
      <Box sx={{ px: 1.5, pb: 3 }}>
        <Typography variant="h6" sx={{ px: 1, pt: 0.5, pb: 0.5 }}>
          Plan my walk
        </Typography>

        {!position ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 6, px: 3 }}>
            <NearMeIcon sx={{ fontSize: 44, opacity: 0.5 }} />
            <Typography sx={{ mt: 1 }}>
              Enable location to plan a route through your nearest unworked prospects.
            </Typography>
            <Button variant="outlined" sx={{ mt: 2 }} onClick={() => enable()}>
              Use my location
            </Button>
          </Box>
        ) : stops.length === 0 ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 6, px: 3 }}>
            <Typography>No unworked prospects to route — everything nearby is knocked.</Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ px: 1, pb: 1.5 }}>
              {stops.length} stop{stops.length === 1 ? '' : 's'} · {formatDistance(total)} total ·
              highest value nearby
            </Typography>
            <Stack spacing={1.25}>
              {stops.map((s, i) => (
                <Card
                  key={s.item.place_id}
                  sx={{ ...glassCardSx, display: 'flex', alignItems: 'center' }}
                >
                  <CardActionArea
                    onClick={() => {
                      setSelectedId(s.item.place_id);
                      onClose();
                    }}
                    sx={{ p: 1.75, flex: 1 }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          bgcolor: '#1a73e8',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {s.item.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {ICP[s.item.type as IcpType].label} · {formatDistance(s.legMeters)} walk ·{' '}
                          {position ? underwrite(s.item, position).valueBand : ''}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardActionArea>
                  <Button
                    size="small"
                    aria-label={`Directions to ${s.item.name}`}
                    onClick={() => openDirections(s.item.address ?? `${s.item.lat},${s.item.lng}`)}
                    sx={{ mr: 1, flexShrink: 0 }}
                  >
                    Go
                  </Button>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </Box>
    </SheetShell>
  );
}
