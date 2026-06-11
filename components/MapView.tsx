'use client';

import { useEffect, useMemo, useState } from 'react';
import { Map, AdvancedMarker, ColorScheme, useMap } from '@vis.gl/react-google-maps';
import { Box, Fab, Popover, Snackbar, CircularProgress, LinearProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import TuneIcon from '@mui/icons-material/Tune';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ClusteredMarkers from './ClusteredMarkers';
import DemandHeatmap from './DemandHeatmap';
import FilterPanel, { type Filters } from './FilterPanel';
import { useData } from './DataProvider';
import { useGeolocation } from '@/lib/useGeolocation';
import { isUrgent } from '@/lib/contracts';
import { MAP_CENTER, MAP_ZOOM } from '@/lib/icp';
import { glassSx } from '@/lib/glass';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

export default function MapView({ searchOpen = false }: { searchOpen?: boolean }) {
  const { views, loading, refreshing, refresh, error, lastPull, selectedId, setSelectedId } =
    useData();
  const [filters, setFilters] = useState<Filters>({
    nb: 'all',
    type: 'all',
    stage: 'all',
    attention: false,
  });
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [heatmapOn, setHeatmapOn] = useState(true);
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
        {/* Demand-style glow under the pins: where prospects are concentrated. */}
        <DemandHeatmap views={filtered} enabled={heatmapOn} />
        <ClusteredMarkers views={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        {geo.position && (
          <AdvancedMarker position={geo.position} title="Your location" zIndex={9999}>
            {/* Uber-style puck: white circle with a dark navigation arrow.
                useGeolocation exposes no heading, so the arrow points up. */}
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: '#fff',
                border: '1px solid rgba(0,0,0,0.15)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M5 0.5 L9 9.5 L5 7.1 L1 9.5 Z" fill="#1a1a1a" />
              </svg>
            </Box>
          </AdvancedMarker>
        )}
      </Map>

      {(loading || refreshing) && (
        <LinearProgress
          sx={{ position: 'absolute', top: 'var(--safe-top)', left: 0, right: 0, zIndex: 1100 }}
        />
      )}

      {/* Orientation pill: how many prospects are on the map right now, and a
          "{shown} of {total}" + tune glyph when filters are trimming the set. */}
      {!loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 'calc(var(--safe-top) + 12px)',
            left: 12,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.25,
            py: 0.5,
            borderRadius: 99,
            bgcolor: 'background.paper',
            color: anyFilter ? 'secondary.main' : 'text.secondary',
            fontSize: '0.85rem',
            fontWeight: 500,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            ...glassSx,
          }}
        >
          {anyFilter && <TuneIcon sx={{ fontSize: 16 }} />}
          {anyFilter
            ? `${filtered.length} of ${views.length}`
            : `${filtered.length} prospect${filtered.length === 1 ? '' : 's'}`}
        </Box>
      )}

      {/* Right-edge stack of equal-size solid near-black circular controls
          (Uber pattern), just above the bottom bar: Refresh, Filter, Heatmap,
          My-location (top → bottom). The wrapper lifts the whole stack up above
          the search sheet when it opens (Apple Maps pattern); pointer-events
          none on it so the map still pans between buttons (each Fab re-enables
          its own). */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          transform: searchOpen ? 'translateY(calc(var(--app-height) * -0.55))' : 'none',
          transition: 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
      <Fab
        aria-label="Refresh prospects"
        size="medium"
        onClick={refresh}
        disabled={refreshing}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 204,
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: 'text.primary',
          ...glassSx,
          pointerEvents: 'auto',
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        {refreshing ? <CircularProgress size={22} color="inherit" /> : <RefreshIcon />}
      </Fab>

      <Fab
        aria-label="Filters"
        size="medium"
        onClick={(e) => setFilterAnchor(filterAnchor ? null : e.currentTarget)}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 144,
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: anyFilter ? 'secondary.main' : 'text.primary',
          ...glassSx,
          pointerEvents: 'auto',
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <TuneIcon />
      </Fab>

      <Fab
        aria-label={heatmapOn ? 'Hide demand heatmap' : 'Show demand heatmap'}
        size="medium"
        onClick={() => setHeatmapOn((on) => !on)}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 84,
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: heatmapOn ? '#ff7a00' : 'text.secondary',
          ...glassSx,
          pointerEvents: 'auto',
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <LocalFireDepartmentIcon />
      </Fab>

      <Fab
        aria-label="My location"
        size="medium"
        onClick={handleRecenter}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 24,
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: geo.position ? '#4285f4' : 'text.secondary',
          ...glassSx,
          pointerEvents: 'auto',
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <MyLocationIcon />
      </Fab>
      </Box>

      <Popover
        open={!!filterAnchor}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
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
        sx={{ pointerEvents: 'none', mb: '32px' }}
      />
      <Snackbar
        open={!!errMsg}
        autoHideDuration={6000}
        onClose={() => setErrMsg(null)}
        message={errMsg ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ pointerEvents: 'none', mb: '32px' }}
      />
    </Box>
  );
}
