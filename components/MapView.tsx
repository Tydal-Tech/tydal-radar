'use client';

import { useEffect, useMemo, useState } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { Box, Fab, Snackbar, CircularProgress, LinearProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchBar from './SearchBar';
import ClusteredMarkers from './ClusteredMarkers';
import FilterChips, { type Filters } from './FilterChips';
import { useData } from './DataProvider';
import { MAP_CENTER, MAP_ZOOM } from '@/lib/icp';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

export default function MapView() {
  const { views, loading, refreshing, refresh, error, lastPull, selectedId, setSelectedId } =
    useData();
  const [filters, setFilters] = useState<Filters>({ nb: 'all', type: 'all', stage: 'all' });
  const [query, setQuery] = useState('');
  const [pullMsg, setPullMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const map = useMap();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views.filter(
      (v) =>
        (filters.nb === 'all' || v.neighborhood === filters.nb) &&
        (filters.type === 'all' || v.type === filters.type) &&
        (filters.stage === 'all' || v.stage === filters.stage) &&
        (!q || v.name.toLowerCase().includes(q) || (v.address ?? '').toLowerCase().includes(q)),
    );
  }, [views, filters, query]);

  // Recenter the map when a prospect is selected (e.g. tapped from Follow-ups).
  useEffect(() => {
    if (!map || !selectedId) return;
    const v = views.find((x) => x.place_id === selectedId);
    if (v) map.panTo({ lat: v.lat, lng: v.lng });
  }, [map, selectedId, views]);

  // Surface transient toasts in local state so they auto-dismiss on a timer.
  useEffect(() => {
    if (lastPull && !refreshing) {
      setPullMsg(`Pulled ${lastPull.total} prospects (${lastPull.added} new).`);
    }
  }, [lastPull, refreshing]);
  useEffect(() => {
    if (error) setErrMsg(error);
  }, [error]);

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Map
        mapId={MAP_ID}
        defaultCenter={MAP_CENTER}
        defaultZoom={MAP_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <ClusteredMarkers views={filtered} onSelect={setSelectedId} />
      </Map>

      <SearchBar value={query} onChange={setQuery} />
      <FilterChips views={views} query={query} filters={filters} setFilters={setFilters} />

      {(loading || refreshing) && (
        <LinearProgress
          sx={{ position: 'absolute', top: 'var(--safe-top)', left: 0, right: 0, zIndex: 1100 }}
        />
      )}

      <Fab
        color="primary"
        variant="extended"
        onClick={refresh}
        disabled={refreshing}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 'calc(var(--safe-bottom) + 16px)',
          zIndex: 1000,
        }}
      >
        {refreshing ? (
          <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
        ) : (
          <RefreshIcon sx={{ mr: 1 }} />
        )}
        {refreshing ? 'Pulling…' : 'Refresh prospects'}
      </Fab>

      <Snackbar
        open={!!pullMsg}
        autoHideDuration={4000}
        onClose={() => setPullMsg(null)}
        message={pullMsg ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ pointerEvents: 'none', mb: 'calc(var(--safe-bottom) + 96px)' }}
      />
      <Snackbar
        open={!!errMsg}
        autoHideDuration={6000}
        onClose={() => setErrMsg(null)}
        message={errMsg ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ pointerEvents: 'none', mb: 'calc(var(--safe-bottom) + 96px)' }}
      />
    </Box>
  );
}
