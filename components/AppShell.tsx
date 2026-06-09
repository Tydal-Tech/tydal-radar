'use client';

import { useState } from 'react';
import { Box } from '@mui/material';
import { APIProvider } from '@vis.gl/react-google-maps';
import DataProvider, { useData } from './DataProvider';
import BottomNav, { type Tab } from './BottomNav';
import MapView from './MapView';
import FollowUps from './FollowUps';
import ProspectSheet from './ProspectSheet';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!;

function ShellInner() {
  const [tab, setTab] = useState<Tab>('map');
  const { views } = useData();
  const followUpCount = views.filter((v) => v.follow_up_date).length;

  return (
    <Box
      sx={{
        height: '100dvh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Keep the map mounted across tabs so it never re-initializes. */}
        <Box sx={{ position: 'absolute', inset: 0, display: tab === 'map' ? 'block' : 'none' }}>
          <MapView />
        </Box>
        {tab === 'followups' && <FollowUps onOpen={() => setTab('map')} />}
      </Box>
      <BottomNav value={tab} onChange={setTab} followUpCount={followUpCount} />
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
