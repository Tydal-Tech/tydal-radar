'use client';

import { useEffect, useMemo, useState } from 'react';
import { Map, AdvancedMarker, ColorScheme, useMap } from '@vis.gl/react-google-maps';
import { Box, Fab, Popover, Snackbar, CircularProgress, LinearProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import TuneIcon from '@mui/icons-material/Tune';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ClusteredMarkers from './ClusteredMarkers';
import DemandHeatmap from './DemandHeatmap';
import FilterPanel from './FilterPanel';
import { useData } from './DataProvider';
import { useGeolocation } from '@/lib/useGeolocation';
import { type Filters, EMPTY_FILTERS, matchesFilters, anyActiveFilter } from '@/lib/filters';
import { MAP_CENTER, MAP_ZOOM } from '@/lib/icp';
import { glassSx } from '@/lib/glass';
import { motion, useTransform, motionValue } from 'framer-motion';
import { useSheetHeight } from './SheetHeightContext';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

export default function MapView({
  onOpenAnalytics,
}: {
  onOpenAnalytics?: () => void;
}) {
  const { views, loading, refreshing, refresh, error, lastPull, selectedId, setSelectedId } =
    useData();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [heatmapOn, setHeatmapOn] = useState(true);
  const [pullMsg, setPullMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pendingRecenter, setPendingRecenter] = useState(false);
  const map = useMap();
  const geo = useGeolocation();

  // Lift the floating control stack so its lowest button rides ~12px above the
  // open sheet's top edge — tracks the sheet's drag/snap via the shared height
  // (0 when no sheet is open, so the stack rests in place).
  const [fallbackHeight] = useState(() => motionValue(0));
  const sheetHeight = useSheetHeight() ?? fallbackHeight;
  const fabY = useTransform(sheetHeight, (h) => -Math.max(0, h - 12));

  const filtered = useMemo(() => views.filter((v) => matchesFilters(v, filters)), [views, filters]);

  const anyFilter = anyActiveFilter(filters);

  // Recenter + zoom in on a selected prospect (tapped from search / a list).
  // Math.max only ever zooms IN, so tapping a pin you're already close to just
  // pans, while a search result from a far-out view flies in to street level.
  useEffect(() => {
    if (!map || !selectedId) return;
    const v = views.find((x) => x.place_id === selectedId);
    if (v) {
      map.panTo({ lat: v.lat, lng: v.lng });
      map.setZoom(Math.max(map.getZoom() ?? MAP_ZOOM, 17));
    }
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
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 2.25,
            py: 1,
            borderRadius: 99,
            bgcolor: 'rgba(20,20,20,0.72)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            color: '#FFFFFF',
            fontSize: '1.1rem',
            fontWeight: 600,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
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
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          y: fabY,
        }}
      >
      {/* Stats — opens the Analytics sheet. Icon-only round control matching the
          other right-edge FABs; sits at the top of the stack and rides the lift. */}
      <Fab
        aria-label="Open stats"
        size="medium"
        onClick={onOpenAnalytics}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 264,
          zIndex: 1000,
          bgcolor: 'background.paper',
          color: 'text.primary',
          ...glassSx,
          pointerEvents: 'auto',
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <BarChartRoundedIcon />
      </Fab>

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
          color: 'text.primary',
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
          color: heatmapOn ? '#ff7a00' : 'text.primary',
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
          color: geo.position ? '#5870E6' : 'text.primary',
          ...glassSx,
          pointerEvents: 'auto',
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <MyLocationIcon />
      </Fab>
      </motion.div>

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
