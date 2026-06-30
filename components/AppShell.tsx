'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { AnimatePresence, motion, motionValue } from 'framer-motion';
import { APIProvider } from '@vis.gl/react-google-maps';
import DataProvider, { useData } from './DataProvider';
import BottomNav, { type Tab } from './BottomNav';
import MapView from './MapView';
import FollowUps from './FollowUps';
import Contracts from './Contracts';
import SearchOverlay from './SearchOverlay';
import Analytics from './Analytics';
import ProspectSheet from './ProspectSheet';
import { SheetHeightContext } from './SheetHeightContext';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!;

function ShellInner() {
  const [tab, setTab] = useState<Tab>('map');
  const { views } = useData();
  const followUpCount = views.filter((v) => v.follow_up_date).length;
  // Shared MotionValue: the open pull-up sheet publishes its height here; the
  // map's floating controls read it to anchor to the sheet's top edge.
  const sheetHeight = useRef(motionValue(0)).current;

  // Shell height = the VISUAL viewport height. iOS Safari does not recompute
  // dvh/vh when the on-screen keyboard opens, so a dvh-sized shell keeps the
  // nav (absolute, bottom:0 in this shell) anchored to the full screen while
  // the visible area is smaller — the persistent black gap. visualViewport is
  // the one value that shrinks when the keyboard opens and restores when it
  // closes; sizing the shell to it makes the nav ride the visible bottom edge.
  // Null (no visualViewport: desktop/SSR) falls back to 100dvh.
  const [vvh, setVvh] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // iOS pans the page up to reveal a focused input; the app is always supposed
      // to be at scroll 0, so undo it — this keeps the relative shell + nav static
      // when the keyboard opens.
      if (window.scrollY !== 0 || vv.offsetTop > 0) window.scrollTo(0, 0);
      // While a field is focused (keyboard open) keep the shell at its full
      // height so the map + nav stay STATIC — the keyboard just overlays them and
      // only the search sheet lifts above it (handled in SheetShell). On blur the
      // next resize has no focused input and restores the full height.
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      setVvh(vv.height);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    // iOS sometimes reports the focus pan as a window scroll with no
    // visualViewport event — catch that too.
    window.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('scroll', update);
    };
  }, []);

  // Shrink-on-scroll: the nav condenses while a list is scrolling, expands ~220ms
  // after it stops. setState(true) is a no-op once already true, so scroll stays cheap.
  const [navCondensed, setNavCondensed] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onListScroll = useCallback(() => {
    setNavCondensed(true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => setNavCondensed(false), 220);
  }, []);
  useEffect(() => {
    setNavCondensed(false);
  }, [tab]);

  return (
    <SheetHeightContext.Provider value={sheetHeight}>
    <Box
      sx={{
        // Full screen WITHOUT position:fixed — iOS shifts fixed elements around
        // the keyboard and can leave the shell shifted up (a persistent bottom
        // gap). html/body stay locked to 100dvh + overflow:hidden; this shell
        // sizes itself to window.visualViewport.height (the visible area), so
        // when the iOS keyboard opens the shell shrinks and the absolute
        // bottom-anchored nav rides the resized container instead of sitting
        // behind the keyboard / leaving a gap. 100dvh is the SSR/desktop
        // fallback when visualViewport is unavailable.
        position: 'relative',
        height: vvh != null ? `${vvh}px` : '100dvh',
        width: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
        // Flex column: the map area (flex:1) stretches to the nav's REAL top
        // edge, so it always fills the space above the bar on iOS regardless of
        // the dynamic viewport / home-indicator safe area — no fixed height and
        // no reliance on a guessed --nav-total for the map's bottom.
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Map area — flex:1 stretches it to fill everything above the nav. Kept
          mounted across tabs so it never re-initializes; visible for Map AND
          Search (search opens as a sheet OVER the map, Apple Maps pattern). The
          map ends exactly at the nav's top, so Google's attribution stays
          visible just above the bar. */}
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <MapView
          onOpenAnalytics={() => setTab((c) => (c === 'analytics' ? 'map' : 'analytics'))}
        />
      </Box>

      {/* Solid bar at the bottom of the column; takes its natural height (incl.
          the home-indicator safe-area pad). The map flexes to meet its top. */}
      <BottomNav
        value={tab}
        onChange={(t) => setTab((cur) => (cur === t && t !== 'map' ? 'map' : t))}
        followUpCount={followUpCount}
        condensed={navCondensed}
      />

      {/* Search, Follow-ups, Contracts and Analytics are pull-up sheets OVER the
          map (same concept as the prospect card): a shared dim scrim + a sliding
          sheet. They overlay the whole shell (the positioned ancestor) and
          anchor just above the nav via --nav-total. Tapping the scrim returns to
          the map. */}
      <AnimatePresence>
        {(tab === 'search' ||
          tab === 'followups' ||
          tab === 'contracts' ||
          tab === 'analytics') && (
          <motion.div
            key="sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setTab('map')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 'var(--nav-total)',
              background: 'rgba(0,0,0,0.32)',
              zIndex: 1090,
            }}
          />
        )}
        {tab === 'search' && (
          <SearchOverlay key="search" onClose={() => setTab('map')} onScroll={onListScroll} />
        )}
        {tab === 'followups' && (
          <FollowUps key="followups" onOpen={() => setTab('map')} onScroll={onListScroll} />
        )}
        {tab === 'contracts' && (
          <Contracts key="contracts" onOpen={() => setTab('map')} onScroll={onListScroll} />
        )}
        {tab === 'analytics' && (
          <Analytics key="analytics" onClose={() => setTab('map')} onScroll={onListScroll} />
        )}
      </AnimatePresence>
      <ProspectSheet />
    </Box>
    </SheetHeightContext.Provider>
  );
}

export default function AppShell() {
  return (
    <APIProvider apiKey={API_KEY} libraries={['places', 'marker']}>
      <DataProvider>
        <ShellInner />
      </DataProvider>
    </APIProvider>
  );
}
