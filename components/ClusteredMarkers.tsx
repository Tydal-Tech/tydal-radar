'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer, SuperClusterAlgorithm, type Renderer } from '@googlemaps/markerclusterer';
import { STAGE_COLORS, type Stage } from '@/lib/stages';
import { urgency } from '@/lib/contracts';
import type { IcpType, ProspectView } from '@/lib/types';

// Tydal brand accent — used only for the selected-pin pulse ring.
const BRAND = '#06b6d4';

// Fraction of the viewport span added as a buffer on every edge, so pins are
// already mounted just outside the screen and slide in as the user pans (no
// empty-then-populate flash). Larger = smoother panning, more mounted markers.
const BUFFER = 0.35;

// Clustering: a modest radius keeps most prospects as individual Uber-style
// pins at city zoom, only merging genuinely overlapping ones into clusters;
// everything breaks out at street level (zoom > maxZoom).
const CLUSTER_RADIUS = 80;
const CLUSTER_MAX_ZOOM = 16; // clusters at <=16, individual ICP pins at >=17

// Stages with no rep activity yet (or a dead end) render recessive — smaller
// and dimmer — so active pipeline stages visually pop on the map.
const INACTIVE_STAGES = new Set<Stage>(['not_knocked', 'not_interested']);

// White SVG glyph per ICP type, centered directly on the stage-colored pin body
// (Material-style solid icons; daycare is stacked toy blocks, dental is a
// simple tooth silhouette). Sized to fill the body minus its padding.
const ICP_SVG: Record<IcpType, string> = {
  daycare:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#fff"><rect x="8" y="3.5" width="8" height="8" rx="1.5"/><rect x="3.5" y="12.5" width="8" height="8" rx="1.5"/><rect x="12.5" y="12.5" width="8" height="8" rx="1.5"/></svg>',
  dental:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#fff"><path d="M12 2C9 2 7 4 7 7c0 1.6.3 3.1.7 4.8.4 1.7.6 3.2.9 4.7.2 1.1.4 2.5 1.4 2.5s1.1-1.4 1.3-2.5c.1-.7.4-1.2.7-1.2s.6.5.7 1.2c.2 1.1.3 2.5 1.3 2.5s1.2-1.4 1.4-2.5c.3-1.5.5-3 .9-4.7C16.7 10.1 17 8.6 17 7c0-3-2-5-5-5z"/></svg>',
  gym:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#fff"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/></svg>',
  office:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#fff"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>',
};

// A flat Uber-style prospect marker: a solid stage-colored circle with the
// white ICP glyph centered directly on it — no center disc, no ring — plus a
// soft drop shadow and a faint 1px dark edge. Active stages render full size
// and crisp; inactive ones (not_knocked / not_interested) render smaller and
// dimmer so pipeline activity dominates the map. The 0×0 root sits at the
// coordinate (AdvancedMarker anchors content bottom-center); children are
// absolutely centered on it.
function buildPin(v: ProspectView): HTMLElement {
  const active = !INACTIVE_STAGES.has(v.stage);
  const u = urgency(v); // due/overdue follow-up or soon-expiring contract
  const size = active ? 28 : 22; // body diameter
  const half = size / 2;

  const root = document.createElement('div');
  root.style.position = 'relative';
  root.className = 'tydal-pin';
  // Dim on the root (not the body): globals.css animates the body's opacity to 1
  // on enter, so an inline body opacity would be overridden mid-animation.
  // Urgent prospects are never dimmed — they must stand out even when the stage
  // itself is inactive.
  if (!active && !u) root.style.opacity = '0.65';

  // Expanding ring shown only for the selected pin (animated via globals.css).
  const pulse = document.createElement('div');
  pulse.className = 'tydal-pulse-ring';
  pulse.style.cssText = [
    'position:absolute',
    `left:${-half}px`,
    `bottom:${-half}px`,
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    `border:1.5px solid ${BRAND}`,
    'box-sizing:border-box',
    'pointer-events:none',
  ].join(';');

  const circle = document.createElement('div');
  circle.className = 'tydal-pin-body';
  circle.style.cssText = [
    'position:absolute',
    `left:${-half}px`,
    `bottom:${-half}px`,
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    `background:${STAGE_COLORS[v.stage]}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    // Padding keeps the white glyph at ~55–60% of the body so it stays legible.
    `padding:${active ? 6 : 5}px`,
    // Flat: just a faint 1px dark edge + a soft drop shadow — no ring.
    active
      ? 'box-shadow:0 0 0 1px rgba(0,0,0,0.25), 0 1px 5px rgba(0,0,0,0.5)'
      : 'box-shadow:0 0 0 1px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.4)',
  ].join(';');
  // White ICP glyph centered directly on the colored body (Uber-style).
  circle.innerHTML = ICP_SVG[v.type as IcpType] ?? ICP_SVG.office;

  root.appendChild(pulse);
  root.appendChild(circle);

  // Urgency badge: a small red/amber dot pinned to the top-right of the body,
  // outlined in the dark map base color so it pops against both the colored
  // pin body and the dark map. Appended last so it renders above the body.
  if (u) {
    const badge = document.createElement('div');
    const badgeSize = 9; // total diameter incl. the 1.5px dark outline
    // Center the badge on the 45° top-right point of the body's edge. The body
    // is centered on the 0×0 root, so that point is at (half·cos45, half·sin45).
    const c = half * Math.SQRT1_2;
    badge.style.cssText = [
      'position:absolute',
      `left:${(c - badgeSize / 2).toFixed(1)}px`,
      `bottom:${(c - badgeSize / 2).toFixed(1)}px`,
      `width:${badgeSize}px`,
      `height:${badgeSize}px`,
      'border-radius:50%',
      `background:${u === 'red' ? '#d93025' : '#f9ab00'}`,
      'border:1.5px solid #000000',
      'box-sizing:border-box',
      'box-shadow:0 1px 3px rgba(0,0,0,0.5)',
      'pointer-events:none',
      'z-index:1',
    ].join(';');
    root.appendChild(badge);
  }

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
// inside. Flat language matches the pins: a solid colored disc, white count, and
// a soft drop shadow — no ring. Clusters whose best stage is still inactive (all
// not_knocked / not_interested) render quieter so clusters containing real
// pipeline activity draw the eye.
function buildCluster(count: number, stage: Stage): HTMLElement {
  const active = !INACTIVE_STAGES.has(stage);
  const size = count < 10 ? 40 : count < 50 ? 48 : 56;
  const root = document.createElement('div');
  root.style.position = 'relative';
  if (!active) root.style.opacity = '0.7';

  const circle = document.createElement('div');
  circle.style.cssText = [
    'position:absolute',
    `left:${-size / 2}px`,
    `bottom:${-size / 2}px`,
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    `background:${STAGE_COLORS[stage]}`,
    'color:#fff',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-weight:700',
    `font-size:${count < 100 ? 15 : 13}px`,
    'font-family:var(--font-roboto), Roboto, sans-serif',
    'text-shadow:0 1px 2px rgba(0,0,0,0.35)',
    // Flat: faint dark edge + soft drop shadow — no white ring.
    'box-shadow:0 0 0 1px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.5)',
  ].join(';');
  circle.textContent = String(count);

  root.appendChild(circle);
  return root;
}

// Renders the prospect pins and groups them with the official MarkerClusterer.
// Viewport culling: only markers inside the current viewport (plus a buffer) are
// ever mounted; the set is recomputed on the map 'idle' event (incrementally
// added/removed), so a zoomed-in pan touches ~on-screen markers, not all 218.
// Clustering runs over that in-viewport set, so culling + clustering cooperate.
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

  const clustererRef = useRef<MarkerClusterer | null>(null);
  // Currently-mounted markers (in viewport + buffer), keyed by place_id.
  const mounted = useRef<Map<string, { marker: google.maps.marker.AdvancedMarkerElement; root: HTMLElement }>>(
    new Map(),
  );
  const stageByMarker = useRef<Map<google.maps.marker.AdvancedMarkerElement, Stage>>(new Map());

  // Latest props read by the idle handler without forcing rebuilds.
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Reconcile mounted markers to the current viewport+buffer. Newly-added markers
  // get the one-shot entrance animation, unless their id is in `skipEnter` (used
  // on a data/filter change so already-shown pins update silently).
  const reconcile = useCallback(
    (skipEnter?: Set<string>) => {
      const m = map;
      const clusterer = clustererRef.current;
      if (!m || !markerLib || !clusterer) return;
      const bounds = m.getBounds();
      if (!bounds) return;
      const { AdvancedMarkerElement } = markerLib;

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const latPad = (ne.lat() - sw.lat()) * BUFFER;
      const lngPad = (ne.lng() - sw.lng()) * BUFFER;
      const minLat = sw.lat() - latPad;
      const maxLat = ne.lat() + latPad;
      const minLng = sw.lng() - lngPad;
      const maxLng = ne.lng() + lngPad;

      const current = mounted.current;
      const visible = new Set<string>();
      const toAdd: google.maps.marker.AdvancedMarkerElement[] = [];

      for (const v of viewsRef.current) {
        if (v.lat < minLat || v.lat > maxLat || v.lng < minLng || v.lng > maxLng) continue;
        visible.add(v.place_id);
        if (current.has(v.place_id)) continue;

        const root = buildPin(v);
        if (!skipEnter?.has(v.place_id)) root.classList.add('tydal-pin--enter');
        if (v.place_id === selectedRef.current) root.classList.add('tydal-pin--selected');
        const marker = new AdvancedMarkerElement({
          position: { lat: v.lat, lng: v.lng },
          title: v.name,
          content: root,
        });
        marker.addListener('click', () => onSelectRef.current(v.place_id));
        current.set(v.place_id, { marker, root });
        stageByMarker.current.set(marker, v.stage);
        toAdd.push(marker);
      }

      const toRemove: google.maps.marker.AdvancedMarkerElement[] = [];
      for (const [id, { marker }] of current) {
        if (visible.has(id)) continue;
        toRemove.push(marker);
        stageByMarker.current.delete(marker);
        current.delete(id);
      }

      if (toRemove.length) clusterer.removeMarkers(toRemove, true);
      if (toAdd.length) clusterer.addMarkers(toAdd, true);
      if (toRemove.length || toAdd.length) clusterer.render();
    },
    [map, markerLib],
  );

  // Create the clusterer once and recompute the visible set on map idle (idle is
  // the debounce — it fires once after movement settles, never per pan frame).
  useEffect(() => {
    if (!map || !markerLib) return;
    const { AdvancedMarkerElement } = markerLib;

    const renderer: Renderer = {
      render: (cluster) => {
        const stages: Stage[] = [];
        for (const mk of cluster.markers) {
          const s = stageByMarker.current.get(mk as google.maps.marker.AdvancedMarkerElement);
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

    const clusterer = new MarkerClusterer({
      map,
      renderer,
      algorithm: new SuperClusterAlgorithm({ radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM }),
    });
    clustererRef.current = clusterer;

    const idle = map.addListener('idle', () => reconcile());

    return () => {
      idle.remove();
      clusterer.clearMarkers(true);
      clusterer.setMap(null);
      mounted.current.clear();
      stageByMarker.current = new Map();
      clustererRef.current = null;
    };
  }, [map, markerLib, reconcile]);

  // On a data/filter change, rebuild the visible set with fresh data (so stage
  // colors update). Previously-shown pins are rebuilt silently; genuinely new
  // ones animate in.
  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!clusterer) return;
    const prev = new Set(mounted.current.keys());
    clusterer.clearMarkers(true);
    mounted.current.clear();
    stageByMarker.current = new Map();
    reconcile(prev);
  }, [views, reconcile]);

  // Toggle the pulse on the selected pin only — no marker rebuild.
  useEffect(() => {
    mounted.current.forEach(({ root }, id) => {
      root.classList.toggle('tydal-pin--selected', id === selectedId);
    });
  }, [selectedId]);

  return null;
}
