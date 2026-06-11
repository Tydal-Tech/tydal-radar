'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
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
        position: 'relative',
        height: 'var(--app-height, 100dvh)',
        width: '100vw',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Content fills the screen; the nav floats over it (full-bleed map). */}
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* Keep the map mounted across tabs so it never re-initializes. */}
        <Box sx={{ position: 'absolute', inset: 0, display: tab === 'map' ? 'block' : 'none' }}>
          <MapView />
        </Box>
        {tab === 'search' && <SearchOverlay onClose={() => setTab('map')} onScroll={onListScroll} />}
        {tab === 'followups' && (
          <FollowUps onOpen={() => setTab('map')} onScroll={onListScroll} />
        )}
        {tab === 'contracts' && (
          <Contracts onOpen={() => setTab('map')} onScroll={onListScroll} />
        )}
      </Box>
      <BottomNav
        value={tab}
        onChange={setTab}
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
