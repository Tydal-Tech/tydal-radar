'use client';

import { useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { STAGE_COLORS, STAGE_ON_COLOR, type Stage } from '@/lib/stages';
import type { IcpType, ProspectView } from '@/lib/types';

// Tydal brand accent. Cyan isn't used by Google's own POI markers, so a constant
// cyan ring reads instantly as "one of ours" vs. native map pins at full zoom.
const BRAND = '#06b6d4';

// Glyph per ICP type, shown in the white center of each pin so the prospect's
// category reads at a glance (stage is the colored body).
const ICP_EMOJI: Record<IcpType, string> = {
  daycare: '🧸',
  dental: '🦷',
  gym: '🏋️',
  office: '🏢',
};

// An iOS-style prospect marker: stage-colored body, ICP glyph in a white center,
// framed by a constant cyan brand ring (with a thin dark separator so the ring
// stays visible even when the body itself is cyan/follow_up) and a white halo for
// contrast on the dark map. A hidden ring child pulses only while selected.
// The 0×0 root sits at the coordinate (AdvancedMarker anchors content
// bottom-center); children are absolutely centered on it.
function buildPin(v: ProspectView): HTMLElement {
  const root = document.createElement('div');
  root.style.position = 'relative';
  root.className = 'tydal-pin';

  // Expanding ring shown only for the selected pin (animated via globals.css).
  const pulse = document.createElement('div');
  pulse.className = 'tydal-pulse-ring';
  pulse.style.cssText = [
    'position:absolute',
    'left:-19px',
    'bottom:-19px',
    'width:38px',
    'height:38px',
    'border-radius:50%',
    `border:2px solid ${BRAND}`,
    'box-sizing:border-box',
    'pointer-events:none',
  ].join(';');

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
    // body · thin dark gap · cyan brand ring · white halo · soft depth shadow
    `box-shadow:0 0 0 1.5px #0b0f1a, 0 0 0 4px ${BRAND}, 0 0 0 6px rgba(255,255,255,0.65), 0 1px 6px rgba(0,0,0,0.55)`,
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
  root.appendChild(pulse);
  root.appendChild(circle);
  return root;
}

// Stage priority for cluster color: the most *advanced* stage present wins, so a
// cluster containing any clients reads green (drawing the eye to progress) rather
// than washing out to grey when most prospects are still not-knocked.
const STAGE_RANK: Record<Stage, number> = {
  not_interested: 0,
  not_knocked: 1,
  knocked: 2,
  talked: 3,
  follow_up: 4,
  client: 5,
};

function clusterStage(stages: Stage[]): Stage {
  let best: Stage = 'not_knocked';
  let bestRank = -1;
  for (const s of stages) {
    if (STAGE_RANK[s] > bestRank) {
      bestRank = STAGE_RANK[s];
      best = s;
    }
  }
  return best;
}

// A cluster bubble colored by its dominant (most-advanced) stage, with the count
// inside. White ring + soft shadow language matches the pins, but a solid colored
// disc (no cyan brand ring) so "group, zoom in" reads distinctly from a door.
function buildCluster(count: number, stage: Stage): HTMLElement {
  const size = count < 10 ? 40 : count < 50 ? 48 : 56;
  const root = document.createElement('div');
  root.style.position = 'relative';

  const circle = document.createElement('div');
  circle.style.cssText = [
    'position:absolute',
    `left:${-size / 2}px`,
    `bottom:${-size / 2}px`,
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    `background:${STAGE_COLORS[stage]}`,
    `color:${STAGE_ON_COLOR[stage]}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-weight:700',
    `font-size:${count < 100 ? 15 : 13}px`,
    'font-family:var(--font-roboto), Roboto, sans-serif',
    'box-shadow:0 0 0 2px rgba(255,255,255,0.85), 0 2px 6px rgba(0,0,0,0.5)',
  ].join(';');
  circle.textContent = String(count);

  root.appendChild(circle);
  return root;
}

// Renders the prospect pins imperatively and groups them with the official
// MarkerClusterer: pins cluster when zoomed out, split apart on zoom-in, and
// clicking a cluster zooms in. Building markers imperatively (instead of one
// React <AdvancedMarker> per prospect) keeps panning smooth at 200+ pins —
// markers are only rebuilt when the visible set (`views`) actually changes,
// never on pan/zoom or on selection.
export default function ClusteredMarkers({
  views,
  selectedId,
  onSelect,
}: {
  views: ProspectView[];
  selectedId: string | null;
  onSelect: (placeId: string) => void;
}) {
  const map = useMap();
  const markerLib = useMapsLibrary('marker');

  // Pin root element per prospect, so selection can toggle the pulse class
  // without rebuilding markers. selectedRef lets a fresh marker set (after a
  // `views` change) restore the pulse on the currently-selected pin.
  const pinRoots = useRef<Map<string, HTMLElement>>(new Map());
  const selectedRef = useRef<string | null>(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!map || !markerLib) return;
    const { AdvancedMarkerElement } = markerLib;

    // Remember each marker's stage so the cluster renderer can color clusters.
    const stageByMarker = new Map<google.maps.marker.AdvancedMarkerElement, Stage>();
    const roots = new Map<string, HTMLElement>();

    const markers = views.map((v) => {
      const root = buildPin(v);
      if (v.place_id === selectedRef.current) root.classList.add('tydal-pin--selected');
      roots.set(v.place_id, root);

      const marker = new AdvancedMarkerElement({
        position: { lat: v.lat, lng: v.lng },
        title: v.name,
        content: root,
      });
      stageByMarker.set(marker, v.stage);
      marker.addListener('click', () => onSelect(v.place_id));
      return marker;
    });
    pinRoots.current = roots;

    const renderer: Renderer = {
      render: (cluster) => {
        const stages: Stage[] = [];
        for (const m of cluster.markers) {
          const s = stageByMarker.get(m as google.maps.marker.AdvancedMarkerElement);
          if (s) stages.push(s);
        }
        const stage = stages.length ? clusterStage(stages) : 'not_knocked';
        return new AdvancedMarkerElement({
          position: cluster.position,
          content: buildCluster(cluster.count, stage),
          zIndex: 1000 + cluster.count,
        });
      },
    };

    const clusterer = new MarkerClusterer({ map, markers, renderer });

    return () => {
      clusterer.clearMarkers();
      clusterer.setMap(null);
      markers.forEach((m) => {
        m.map = null;
      });
      pinRoots.current = new Map();
    };
  }, [map, markerLib, views, onSelect]);

  // Toggle the pulse on the selected pin only — no marker rebuild, so this is
  // cheap and never touches the other pins.
  useEffect(() => {
    pinRoots.current.forEach((root, id) => {
      root.classList.toggle('tydal-pin--selected', id === selectedId);
    });
  }, [selectedId]);

  return null;
}
