'use client';

import { useEffect } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { STAGE_COLORS } from '@/lib/stages';
import type { IcpType, ProspectView } from '@/lib/types';

// Glyph per ICP type, shown in the white center of each pin so the prospect's
// category reads at a glance (stage is the colored ring around it).
const ICP_EMOJI: Record<IcpType, string> = {
  daycare: '🧸',
  dental: '🦷',
  gym: '🏋️',
  office: '🏢',
};

// A clean iOS-style marker: a stage-colored ring around a white center holding
// the ICP glyph. Soft drop shadow for depth, no hard outline. The 0×0 root sits
// at the coordinate (AdvancedMarker anchors content bottom-center); the circle
// is absolutely centered on it so the pin marks the exact point.
function buildPin(v: ProspectView): HTMLElement {
  const root = document.createElement('div');
  root.style.position = 'relative';

  const circle = document.createElement('div');
  circle.style.cssText = [
    'position:absolute',
    'left:-19px',
    'bottom:-19px',
    'width:38px',
    'height:38px',
    'border-radius:50%',
    `background:${STAGE_COLORS[v.stage]}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-shadow:0 0 3px rgba(255,255,255,0.35), 0 2px 6px rgba(0,0,0,0.5)',
  ].join(';');

  const inner = document.createElement('div');
  inner.style.cssText = [
    'width:26px',
    'height:26px',
    'border-radius:50%',
    'background:#fff',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:16px',
    'line-height:1',
  ].join(';');
  inner.textContent = ICP_EMOJI[v.type as IcpType] ?? '📍';

  circle.appendChild(inner);
  root.appendChild(circle);
  return root;
}

// Renders the prospect pins imperatively and groups them with the official
// MarkerClusterer: pins cluster when zoomed out, split apart on zoom-in, and
// clicking a cluster zooms in. Building markers imperatively (instead of one
// React <AdvancedMarker> per prospect) keeps panning smooth at 200+ pins —
// markers are only rebuilt when the visible set (`views`) actually changes,
// never on pan/zoom.
export default function ClusteredMarkers({
  views,
  onSelect,
}: {
  views: ProspectView[];
  onSelect: (placeId: string) => void;
}) {
  const map = useMap();
  const markerLib = useMapsLibrary('marker');

  useEffect(() => {
    if (!map || !markerLib) return;
    const { AdvancedMarkerElement } = markerLib;

    const markers = views.map((v) => {
      const marker = new AdvancedMarkerElement({
        position: { lat: v.lat, lng: v.lng },
        title: v.name,
        content: buildPin(v),
      });
      marker.addListener('click', () => onSelect(v.place_id));
      return marker;
    });

    const clusterer = new MarkerClusterer({ map, markers });

    return () => {
      clusterer.clearMarkers();
      clusterer.setMap(null);
      markers.forEach((m) => {
        m.map = null;
      });
    };
  }, [map, markerLib, views, onSelect]);

  return null;
}
