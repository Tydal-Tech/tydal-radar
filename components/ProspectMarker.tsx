'use client';

import { memo } from 'react';
import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { STAGE_COLORS } from '@/lib/stages';
import type { ProspectView } from '@/lib/types';

function ProspectMarker({
  view,
  onClick,
}: {
  view: ProspectView;
  onClick: () => void;
}) {
  const color = STAGE_COLORS[view.stage];
  return (
    <AdvancedMarker
      position={{ lat: view.lat, lng: view.lng }}
      onClick={onClick}
      title={view.name}
    >
      <Pin background={color} borderColor="#1a1f36" glyphColor="#ffffff" />
    </AdvancedMarker>
  );
}

export default memo(ProspectMarker);
