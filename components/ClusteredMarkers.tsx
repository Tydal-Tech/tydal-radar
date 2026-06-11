'use client';

import { useEffect } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { STAGE_COLORS } from '@/lib/stages';
import type { ProspectView } from '@/lib/types';

// Renders the prospect pins imperatively and groups them with the official
// MarkerClusterer: pins cluster when zoomed out, split apart on zoom-in, and
// clicking a cluster zooms in. Building markers imperatively (instead of one
// React <AdvancedMarker> per prospect) keeps panning smooth at 200+ pins —
// markers are only rebuilt when the visible set (`views`) actually changes,
// never on pan/zoom. Pins keep the stage-color fill, with a white halo for
// contrast against grey streets.
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
    const { AdvancedMarkerElement, PinElement } = markerLib;

    const markers = views.map((v) => {
      const pin = new PinElement({
        background: STAGE_COLORS[v.stage],
        borderColor: '#1a1f36',
        glyphColor: '#ffffff',
      });
      // White contrast halo (plus a soft drop shadow) so the stage-colored pins
      // stand out against grey streets when zoomed in. Stacking thin white
      // shadows traces the teardrop outline; fill and shape are unchanged.
      pin.element.style.filter =
        'drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff) drop-shadow(0 1px 2px rgba(0,0,0,0.45))';
      const marker = new AdvancedMarkerElement({
        position: { lat: v.lat, lng: v.lng },
        title: v.name,
        content: pin.element,
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
