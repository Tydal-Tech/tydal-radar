'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { APIProvider } from '@vis.gl/react-google-maps';
import DataProvider, { useData } from './DataProvider';
import { SPRING_120 } from '@/lib/motion';
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
  // framer's JS springs aren't covered by the CSS reduced-motion blanket, so
  // gate the tab transition here (instant swap when reduced motion is set).
  const reduceMotion = useReducedMotion();

  // Shared fade+slide for the two list views (transform/opacity only, map-safe).
  // Enter rides the 120Hz spring; exit is a quick ease so `mode="wait"` hands
  // off to the next tab without feeling sluggish.
  const listViewMotion = {
    initial: reduceMotion ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: {
      opacity: 0,
      y: reduceMotion ? 0 : 8,
      transition: reduceMotion ? { duration: 0 } : { duration: 0.12, ease: 'easeIn' as const },
    },
    transition: reduceMotion ? { duration: 0 } : SPRING_120,
    style: { position: 'absolute' as const, inset: 0 },
  };

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
        position: 'fixed',
        top: 0,
        left: 0,
        height: 'var(--app-height, 100dvh)',
        width: '100vw',
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
            display: tab === 'map' || tab === 'search' ? 'block' : 'none',
          }}
        >
          <MapView searchOpen={tab === 'search'} />
        </Box>
        <AnimatePresence>
          {tab === 'search' && (
            <motion.div
              key="search-scrim"
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
        </AnimatePresence>
        {/* List views fade + slide on tab change. A separate AnimatePresence from
            the search sheet/scrim above, so their choreography is untouched.
            mode="wait" sequences the outgoing/incoming views (both are opaque,
            absolutely-positioned panels); initial={false} keeps app launch quiet. */}
        <AnimatePresence mode="wait" initial={false}>
          {tab === 'followups' && (
            <motion.div key="followups" {...listViewMotion}>
              <FollowUps onOpen={() => setTab('map')} onScroll={onListScroll} />
            </motion.div>
          )}
          {tab === 'contracts' && (
            <motion.div key="contracts" {...listViewMotion}>
              <Contracts onOpen={() => setTab('map')} onScroll={onListScroll} />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
      <BottomNav
        value={tab}
        onChange={(t) => setTab((cur) => (t === 'search' && cur === 'search' ? 'map' : t))}
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
