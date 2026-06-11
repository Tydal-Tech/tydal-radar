'use client';

import { useEffect, useMemo, useState } from 'react';
import { Map, AdvancedMarker, ColorScheme, useMap } from '@vis.gl/react-google-maps';
import { Box, Fab, Snackbar, CircularProgress, LinearProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SearchBar from './SearchBar';
import ClusteredMarkers from './ClusteredMarkers';
import FilterChips, { type Filters } from './FilterChips';
import { useData } from './DataProvider';
import { useGeolocation } from '@/lib/useGeolocation';
import { MAP_CENTER, MAP_ZOOM } from '@/lib/icp';
import { glassSx } from '@/lib/glass';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

export default function MapView() {
  const { views, loading, refreshing, refresh, error, lastPull, selectedId, setSelectedId } =
    useData();
  const [filters, setFilters] = useState<Filters>({ nb: 'all', type: 'all', stage: 'all' });
  const [query, setQuery] = useState('');
  const [pullMsg, setPullMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pendingRecenter, setPendingRecenter] = useState(false);
  const map = useMap();
  const geo = useGeolocation();

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
  useEffect(() => {
    if (geo.error) setErrMsg(geo.error);
  }, [geo.error]);

  // Recenter on the GPS dot once a fix arrives after the button is tapped.
  useEffect(() => {
    if (pendingRecenter && geo.position && map) {
      map.panTo(geo.position);
      map.setZoom(Math.max(map.getZoom() ?? MAP_ZOOM, 16));
      setPendingRecenter(false);
    }
  }, [pendingRecenter, geo.position, map]);

  // Tap the locate button: first use asks permission; afterwards it recenters.
  const handleRecenter = () => {
    if (!geo.enabled) {
      geo.enable();
      setPendingRecenter(true);
    } else if (geo.position && map) {
      map.panTo(geo.position);
      map.setZoom(Math.max(map.getZoom() ?? MAP_ZOOM, 16));
    } else {
      setPendingRecenter(true);
    }
  };

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Map
        mapId={MAP_ID}
        colorScheme={ColorScheme.DARK}
        defaultCenter={MAP_CENTER}
        defaultZoom={MAP_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <ClusteredMarkers views={filtered} onSelect={setSelectedId} />
        {geo.position && (
          <AdvancedMarker position={geo.position} title="Your location" zIndex={9999}>
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                bgcolor: '#4285f4',
                border: '2.5px solid #fff',
                boxShadow: '0 0 0 1.5px rgba(66,133,244,0.45), 0 1px 4px rgba(0,0,0,0.4)',
              }}
            />
          </AdvancedMarker>
        )}
      </Map>

      <SearchBar value={query} onChange={setQuery} />
      <FilterChips views={views} query={query} filters={filters} setFilters={setFilters} />

      {(loading || refreshing) && (
        <LinearProgress
          sx={{ position: 'absolute', top: 'var(--safe-top)', left: 0, right: 0, zIndex: 1100 }}
        />
      )}

      {/* Right-edge stack of equal-size circular glass controls (Apple pattern):
          Refresh on top, My-location below. */}
      <Fab
        aria-label="Refresh prospects"
        size="medium"
        onClick={refresh}
        disabled={refreshing}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 'calc(var(--ui-bottom) + 192px)',
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: 'text.primary',
          ...glassSx,
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        {refreshing ? <CircularProgress size={22} color="inherit" /> : <RefreshIcon />}
      </Fab>

      <Fab
        aria-label="My location"
        size="medium"
        onClick={handleRecenter}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 'calc(var(--ui-bottom) + 132px)',
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: geo.position ? '#4285f4' : 'text.secondary',
          ...glassSx,
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <MyLocationIcon />
      </Fab>

      <Snackbar
        open={!!pullMsg}
        autoHideDuration={4000}
        onClose={() => setPullMsg(null)}
        message={pullMsg ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ pointerEvents: 'none', mb: 'calc(var(--ui-bottom) + 128px)' }}
      />
      <Snackbar
        open={!!errMsg}
        autoHideDuration={6000}
        onClose={() => setErrMsg(null)}
        message={errMsg ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ pointerEvents: 'none', mb: 'calc(var(--ui-bottom) + 128px)' }}
      />
    </Box>
  );
}
