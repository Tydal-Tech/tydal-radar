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
        // gap). Instead html/body are locked to 100dvh + overflow:hidden and this
        // fills them at 100dvh. dvh ignores the keyboard, so opening it can't
        // resize/shift the app — the keyboard just overlays it.
        position: 'relative',
        height: '100dvh',
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
