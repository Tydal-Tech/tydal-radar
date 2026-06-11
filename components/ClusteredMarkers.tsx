'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer, SuperClusterAlgorithm, type Renderer } from '@googlemaps/markerclusterer';
import { STAGE_COLORS, STAGE_ON_COLOR, type Stage } from '@/lib/stages';
import { urgency } from '@/lib/contracts';
import type { IcpType, ProspectView } from '@/lib/types';

// Tydal brand accent — used only for the selected-pin pulse ring. The constant
// pin ring is white (still unmistakably "ours" vs. Google's grey POI teardrops)
// so it never merges with the cyan follow_up stage body.
const BRAND = '#06b6d4';

// Fraction of the viewport span added as a buffer on every edge, so pins are
// already mounted just outside the screen and slide in as the user pans (no
// empty-then-populate flash). Larger = smoother panning, more mounted markers.
const BUFFER = 0.35;

// Clustering: aggressive radius collapses city/mid zoom into a clean handful of
// clusters; pins only break out at street level (zoom > maxZoom).
const CLUSTER_RADIUS = 220;
const CLUSTER_MAX_ZOOM = 16; // clusters at <=16, individual ICP pins at >=17

// Stages with no rep activity yet (or a dead end) render recessive — smaller,
// dimmer, muted ring — so active pipeline stages visually pop on the map.
const INACTIVE_STAGES = new Set<Stage>(['not_knocked', 'not_interested']);

// Glyph per ICP type, shown in the white center of each pin.
const ICP_EMOJI: Record<IcpType, string> = {
  daycare: '🧸',
  dental: '🦷',
  gym: '🏋️',
  office: '🏢',
};

// A compact iOS-style prospect marker: stage-colored body, ICP glyph in a white
// center, framed by a thin white ring (with a 1px dark separator so the ring
// reads on any stage color) and a soft depth shadow. Active stages render full
// size and crisp; inactive ones (not_knocked / not_interested) render smaller
// and dimmer so pipeline activity dominates the map. The 0×0 root sits at the
// coordinate (AdvancedMarker anchors content bottom-center); children are
// absolutely centered on it.
function buildPin(v: ProspectView): HTMLElement {
  const active = !INACTIVE_STAGES.has(v.stage);
  const u = urgency(v); // due/overdue follow-up or soon-expiring contract
  const size = active ? 28 : 22; // body diameter
  const innerSize = active ? 20 : 15; // white glyph disc
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
    // body · 1px dark gap · white ring (crisp when active, thin+muted when
    // inactive) · soft depth shadow
    active
      ? 'box-shadow:0 0 0 1px #0b0f1a, 0 0 0 2.5px #fff, 0 1px 5px rgba(0,0,0,0.5)'
      : 'box-shadow:0 0 0 1px #0b0f1a, 0 0 0 2px rgba(255,255,255,0.55), 0 1px 3px rgba(0,0,0,0.4)',
  ].join(';');

  const inner = document.createElement('div');
  inner.style.cssText = [
    `width:${innerSize}px`,
    `height:${innerSize}px`,
    'border-radius:50%',
    `background:${active ? '#fff' : 'rgba(255,255,255,0.85)'}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    `font-size:${active ? 13 : 10}px`,
    'line-height:1',
  ].join(';');
  inner.textContent = ICP_EMOJI[v.type as IcpType] ?? '📍';

  circle.appendChild(inner);
  root.appendChild(pulse);
  root.appendChild(circle);

  // Urgency badge: a small red/amber dot pinned to the top-right of the body,
  // outlined in the dark map base color so it pops against both the white pin
  // ring and the dark map. Appended last so it renders above the body.
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
      'border:1.5px solid #0b0f1a',
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
// inside. White ring + soft shadow language matches the pins, but a solid colored
// disc (no brand ring) so "group, zoom in" reads distinctly from a door. Clusters
// whose best stage is still inactive (all not_knocked / not_interested) render
// quieter so clusters containing real pipeline activity draw the eye.
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
    `color:${STAGE_ON_COLOR[stage]}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-weight:700',
    `font-size:${count < 100 ? 15 : 13}px`,
    'font-family:var(--font-roboto), Roboto, sans-serif',
    active
      ? 'box-shadow:0 0 0 2px rgba(255,255,255,0.85), 0 2px 6px rgba(0,0,0,0.5)'
      : 'box-shadow:0 0 0 2px rgba(255,255,255,0.55), 0 2px 5px rgba(0,0,0,0.4)',
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
