'use client';

import { useEffect, useMemo, useState } from 'react';
import { Map, AdvancedMarker, ColorScheme, useMap } from '@vis.gl/react-google-maps';
import { Box, Fab, Popover, Snackbar, CircularProgress, LinearProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import TuneIcon from '@mui/icons-material/Tune';
import ClusteredMarkers from './ClusteredMarkers';
import FilterPanel, { type Filters } from './FilterPanel';
import { useData } from './DataProvider';
import { useGeolocation } from '@/lib/useGeolocation';
import { isUrgent } from '@/lib/contracts';
import { MAP_CENTER, MAP_ZOOM } from '@/lib/icp';
import { glassSx } from '@/lib/glass';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

export default function MapView() {
  const { views, loading, refreshing, refresh, error, lastPull, selectedId, setSelectedId } =
    useData();
  const [filters, setFilters] = useState<Filters>({
    nb: 'all',
    type: 'all',
    stage: 'all',
    attention: false,
  });
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [pullMsg, setPullMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pendingRecenter, setPendingRecenter] = useState(false);
  const map = useMap();
  const geo = useGeolocation();

  const filtered = useMemo(
    () =>
      views.filter(
        (v) =>
          (filters.nb === 'all' || v.neighborhood === filters.nb) &&
          (filters.type === 'all' || v.type === filters.type) &&
          (filters.stage === 'all' || v.stage === filters.stage) &&
          (!filters.attention || isUrgent(v)),
      ),
    [views, filters],
  );

  const anyFilter =
    filters.nb !== 'all' || filters.type !== 'all' || filters.stage !== 'all' || filters.attention;

  // Recenter the map when a prospect is selected (e.g. tapped from search / Follow-ups).
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

  // Gesture-aware blur: while the map is actively panning/zooming, tag the
  // document root with .map-moving so .tydal-glass surfaces pause their backdrop
  // blur (re-blurring a moving map every frame is the one real perf risk).
  // Blur is restored on idle; fill, sheen and border stay throughout.
  useEffect(() => {
    if (!map) return;
    const start = () => document.documentElement.classList.add('map-moving');
    const end = () => document.documentElement.classList.remove('map-moving');
    const l1 = map.addListener('dragstart', start);
    const l2 = map.addListener('zoom_changed', start);
    const l3 = map.addListener('idle', end);
    return () => {
      l1.remove();
      l2.remove();
      l3.remove();
      document.documentElement.classList.remove('map-moving');
    };
  }, [map]);

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
        <ClusteredMarkers views={filtered} selectedId={selectedId} onSelect={setSelectedId} />
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

      {(loading || refreshing) && (
        <LinearProgress
          sx={{ position: 'absolute', top: 'var(--safe-top)', left: 0, right: 0, zIndex: 1100 }}
        />
      )}

      {/* Right-edge stack of equal-size circular glass controls (Apple pattern):
          Refresh on top, Filter in the middle, My-location below. */}
      <Fab
        aria-label="Refresh prospects"
        size="medium"
        className="tydal-glass"
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
        aria-label="Filters"
        size="medium"
        className="tydal-glass"
        onClick={(e) => setFilterAnchor(filterAnchor ? null : e.currentTarget)}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 'calc(var(--ui-bottom) + 132px)',
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: anyFilter ? 'secondary.main' : 'text.primary',
          ...glassSx,
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <TuneIcon />
      </Fab>

      <Fab
        aria-label="My location"
        size="medium"
        className="tydal-glass"
        onClick={handleRecenter}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 'calc(var(--ui-bottom) + 72px)',
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: geo.position ? '#4285f4' : 'text.secondary',
          ...glassSx,
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <MyLocationIcon />
      </Fab>

      <Popover
        open={!!filterAnchor}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            className: 'tydal-glass',
            sx: { ...glassSx, borderRadius: 3, mt: -1, overflow: 'hidden' },
          },
        }}
      >
        <FilterPanel views={views} filters={filters} setFilters={setFilters} />
      </Popover>

      <Snackbar
        open={!!pullMsg}
        autoHideDuration={4000}
        onClose={() => setPullMsg(null)}
        message={pullMsg ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ pointerEvents: 'none', mb: 'calc(var(--ui-bottom) + 72px)' }}
      />
      <Snackbar
        open={!!errMsg}
        autoHideDuration={6000}
        onClose={() => setErrMsg(null)}
        message={errMsg ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ pointerEvents: 'none', mb: 'calc(var(--ui-bottom) + 72px)' }}
      />
    </Box>
  );
}
