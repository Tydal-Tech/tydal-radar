'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { ProspectView } from '@/lib/types';

// Uber-Driver-style "demand" glow: a soft transparent→yellow→amber→orange→red
// ramp showing where prospects are concentrated, rendered under the pins on the
// dark map.
//
// Note: Google removed `google.maps.visualization.HeatmapLayer` from the Maps
// JS API in v3.65, so this is a small self-contained canvas heatmap: an
// OverlayView whose canvas lives in the map's `overlayLayer` pane — above the
// tiles, below the marker panes — so pins always stay visible/tappable on top.
const RADIUS = 42; // glow radius per point, in screen px (i.e. "dissipating")
const OPACITY = 0.65; // overall layer opacity
const GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(255,235,130,0.35)',
  'rgba(255,193,7,0.6)',
  'rgba(255,138,0,0.78)',
  'rgba(244,67,54,0.92)',
];
// Density each point stamps into the alpha buffer: one lone prospect reads as a
// soft yellow glow; a few overlapping prospects ramp through amber to red.
const POINT_ALPHA = 0.24;
// Extra canvas margin (px) on every edge so pans stay covered between idle
// re-fits, matching the buffered-viewport feel of the marker culling.
const PAD = 160;

// 256-entry RGBA lookup table sampled from the gradient: density (accumulated
// alpha 0–255) indexes into it during the colorize pass.
function buildLut(): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  GRADIENT.forEach((color, i) => grad.addColorStop(i / (GRADIENT.length - 1), color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

// A grayscale blurred dot (radial 1→0 alpha falloff) stamped once per point.
function buildStamp(): HTMLCanvasElement {
  const size = RADIUS * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(RADIUS, RADIUS, 0, RADIUS, RADIUS, RADIUS);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

type HeatOverlay = google.maps.OverlayView & {
  setData(views: readonly ProspectView[]): void;
  setEnabled(on: boolean): void;
  refresh(): void;
};

// Factory (not a module-scope class) because `google.maps.OverlayView` only
// exists once the Maps API has loaded — callers invoke this when `useMap()`
// is non-null.
function createHeatOverlay(): HeatOverlay {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.pointerEvents = 'none';
  const ctx = canvas.getContext('2d')!;
  const stamp = buildStamp();
  const lut = buildLut();
  let points: google.maps.LatLng[] = [];
  let raf = 0;

  class Overlay extends google.maps.OverlayView {
    private painted = false;

    setData(views: readonly ProspectView[]) {
      points = views.map((v) => new google.maps.LatLng(v.lat, v.lng));
      this.refresh();
    }

    setEnabled(on: boolean) {
      canvas.style.display = on ? 'block' : 'none';
      if (on) this.refresh();
    }

    onAdd() {
      this.getPanes()?.overlayLayer.appendChild(canvas);
    }

    onRemove() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.remove();
    }

    // The API calls draw() on every camera-move frame. We paint ONCE (the first
    // time a projection is available) and then skip: during pans/zooms the
    // canvas rides the overlay pane's transform (like the markers), and we
    // re-fit it to the new viewport on map 'idle' via refresh(). This keeps the
    // getImageData-heavy render off the per-frame path, so panning stays smooth.
    draw() {
      if (this.painted) return;
      this.painted = true;
      this.refresh();
    }

    // rAF-coalesced full redraw — driven by idle / data change / (re)enable.
    refresh() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        this.render();
      });
    }

    render() {
      if (canvas.style.display === 'none') return;
      const proj = this.getProjection();
      const map = this.getMap();
      if (!proj || !(map instanceof google.maps.Map)) return;
      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = proj.fromLatLngToDivPixel(bounds.getSouthWest());
      const ne = proj.fromLatLngToDivPixel(bounds.getNorthEast());
      if (!sw || !ne) return;

      // Cover the viewport (plus PAD) in the pane's div-pixel space.
      const left = sw.x - PAD;
      const top = ne.y - PAD;
      const w = Math.ceil(ne.x - sw.x) + PAD * 2;
      const h = Math.ceil(sw.y - ne.y) + PAD * 2;
      if (w <= 0 || h <= 0) return;
      canvas.style.left = `${left}px`;
      canvas.style.top = `${top}px`;
      // 1× resolution on purpose: the glow is blurry by design, and skipping the
      // retina upscale keeps the per-pixel colorize pass ~4× cheaper.
      canvas.width = w; // also clears the canvas
      canvas.height = h;

      // Pass 1: accumulate density as grayscale alpha with the blurred stamp.
      ctx.globalAlpha = POINT_ALPHA;
      for (const p of points) {
        const px = proj.fromLatLngToDivPixel(p);
        if (!px) continue;
        const x = px.x - left;
        const y = px.y - top;
        // Include just-offscreen points whose glow bleeds into the canvas.
        if (x < -RADIUS || y < -RADIUS || x > w + RADIUS || y > h + RADIUS) continue;
        ctx.drawImage(stamp, x - RADIUS, y - RADIUS);
      }

      // Pass 2: colorize density through the gradient LUT.
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 3; i < d.length; i += 4) {
        const a = d[i]; // accumulated density 0–255
        if (!a) continue;
        const j = a * 4;
        d[i - 3] = lut[j];
        d[i - 2] = lut[j + 1];
        d[i - 1] = lut[j + 2];
        d[i] = Math.round(lut[j + 3] * OPACITY);
      }
      ctx.putImageData(img, 0, 0);
    }
  }

  return new Overlay();
}

// Imperative map layer: renders nothing in the React tree.
export default function DemandHeatmap({
  views,
  enabled = true,
}: {
  views: ProspectView[];
  enabled?: boolean;
}) {
  const map = useMap();
  const overlayRef = useRef<HeatOverlay | null>(null);
  // Latest props, readable by the create-effect without retriggering it.
  const viewsRef = useRef(views);
  const enabledRef = useRef(enabled);

  // Attach the overlay once the map is ready; detach on unmount.
  useEffect(() => {
    if (!map) return;
    const overlay = createHeatOverlay();
    overlay.setMap(map);
    overlay.setData(viewsRef.current);
    overlay.setEnabled(enabledRef.current);
    overlayRef.current = overlay;
    // Re-fit the glow to the new viewport once the camera settles (the same
    // event the marker culling uses) — not on every pan frame.
    const idle = map.addListener('idle', () => overlay.refresh());
    return () => {
      idle.remove();
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  // Rebuild the data points whenever the (filtered) prospect set changes.
  useEffect(() => {
    viewsRef.current = views;
    overlayRef.current?.setData(views);
  }, [views]);

  // Toggle visibility from the heatmap button.
  useEffect(() => {
    enabledRef.current = enabled;
    overlayRef.current?.setEnabled(enabled);
  }, [enabled]);

  return null;
}
