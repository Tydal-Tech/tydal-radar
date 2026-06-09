'use client';

import { useEffect, useMemo, useState } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { Box, Fab, Snackbar, CircularProgress, LinearProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchBar from './SearchBar';
import ProspectMarker from './ProspectMarker';
import FilterChips, { type Filters } from './FilterChips';
import { useData } from './DataProvider';
import { MAP_CENTER, MAP_ZOOM } from '@/lib/icp';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

export default function MapView() {
  const { views, loading, refreshing, refresh, error, lastPull, selectedId, setSelectedId } =
    useData();
  const [filters, setFilters] = useState<Filters>({ nb: 'all', type: 'all', stage: 'all' });
  const [query, setQuery] = useState('');
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
        {filtered.map((v) => (
          <ProspectMarker key={v.place_id} view={v} onClick={() => setSelectedId(v.place_id)} />
        ))}
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
        open={!!lastPull && !refreshing}
        autoHideDuration={5000}
        message={lastPull ? `Pulled ${lastPull.total} prospects (${lastPull.added} new).` : ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ mb: 'calc(var(--safe-bottom) + 80px)' }}
      />
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        message={error ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ mb: 'calc(var(--safe-bottom) + 80px)' }}
      />
    </Box>
  );
}
