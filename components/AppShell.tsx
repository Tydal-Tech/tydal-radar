'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { APIProvider } from '@vis.gl/react-google-maps';
import DataProvider, { useData } from './DataProvider';
import BottomNav, { type Tab } from './BottomNav';
import MapView from './MapView';
import FollowUps from './FollowUps';
import Contracts from './Contracts';
import SearchOverlay from './SearchOverlay';
import ProspectSheet from './ProspectSheet';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!;

function ShellInner() {
  const [tab, setTab] = useState<Tab>('map');
  const { views } = useData();
  const followUpCount = views.filter((v) => v.follow_up_date).length;

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
    const update = () => setVvh(vv.height);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
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
      }}
    >
      {/* Content fills the screen; the nav floats over it (full-bleed map). */}
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* Keep the map mounted across tabs so it never re-initializes. Visible
            for Map AND Search — search opens as a sheet OVER the map (Apple Maps
            pattern). Ends at the bottom bar's top (--nav-total) so Google's
            attribution stays visible above the flush bar. */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 'var(--nav-total)',
            display: 'block',
          }}
        >
          <MapView sheetOpen={tab !== 'map'} />
        </Box>
        {/* Search, Follow-ups and Contracts are all pull-up sheets OVER the map
            (same concept as the prospect card): a shared dim scrim + a sliding
            sheet. Tapping the scrim closes back to the map. */}
        <AnimatePresence>
          {(tab === 'search' || tab === 'followups' || tab === 'contracts') && (
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
        </AnimatePresence>
      </Box>
      <BottomNav
        value={tab}
        onChange={(t) => setTab((cur) => (cur === t && t !== 'map' ? 'map' : t))}
        followUpCount={followUpCount}
        condensed={navCondensed}
      />
      <ProspectSheet />
    </Box>
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
