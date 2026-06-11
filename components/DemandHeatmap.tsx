'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { STAGE_COLORS, type Stage } from '@/lib/stages';
import type { ProspectView } from '@/lib/types';

// Uber-Driver-style "demand" glow rendered under the pins on the dark map.
// not_knocked prospects feed the classic transparent→yellow→amber→orange→red
// DENSITY ramp (where the cold leads pile up). Every prospect whose stage IS set
// instead glows that STAGE's color (client = green, talked = blue, follow_up =
// cyan, knocked = amber, not_interested = grey), so progress reads as color on
// the map. The stage glows composite additively over the demand base.
//
// Note: Google removed `google.maps.visualization.HeatmapLayer` from the Maps JS
// API in v3.65, so this is a self-contained canvas heatmap: an OverlayView whose
// canvas lives in the map's `overlayLayer` pane — above the tiles, below the
// marker panes — so pins always stay visible/tappable on top.
const RADIUS = 42; // glow radius per point, in screen px (i.e. "dissipating")
const OPACITY = 0.65; // overall layer opacity
const GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(255,235,130,0.35)',
  'rgba(255,193,7,0.6)',
  'rgba(255,138,0,0.78)',
  'rgba(244,67,54,0.92)',
];
// Density each not_knocked point stamps into the alpha buffer.
const POINT_ALPHA = 0.24;
// Extra canvas margin (px) on every edge so pans stay covered between idle re-fits.
const PAD = 220;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// 256-entry RGBA LUT sampled from the demand gradient (for not_knocked density).
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

// Grayscale blurred dot (radial 1→0 alpha) — accumulates density for not_knocked.
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

// A soft radial glow in a stage's color, stamped (additively) per set-stage point.
function buildColorStamp(hex: string): HTMLCanvasElement {
  const { r, g, b } = hexToRgb(hex);
  const size = RADIUS * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(RADIUS, RADIUS, 0, RADIUS, RADIUS, RADIUS);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.75)`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.35)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

type Pt = { ll: google.maps.LatLng; stage: Stage };

type HeatOverlay = google.maps.OverlayView & {
  setData(views: readonly ProspectView[]): void;
  setEnabled(on: boolean): void;
  refresh(): void;
};

// Factory (not a module-scope class) because `google.maps.OverlayView` only
// exists once the Maps API has loaded — callers invoke this when `useMap()` is
// non-null.
function createHeatOverlay(): HeatOverlay {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.pointerEvents = 'none';
  const ctx = canvas.getContext('2d')!;
  const stamp = buildStamp();
  const lut = buildLut();
  const colorStamps = new Map<string, HTMLCanvasElement>();
  const colorStampFor = (hex: string) => {
    let s = colorStamps.get(hex);
    if (!s) {
      s = buildColorStamp(hex);
      colorStamps.set(hex, s);
    }
    return s;
  };
  let pts: Pt[] = [];
  let raf = 0;

  class Overlay extends google.maps.OverlayView {
    private anchorTL: google.maps.LatLng | null = null;
    private anchorBR: google.maps.LatLng | null = null;
    private renderW = 0;

    setData(views: readonly ProspectView[]) {
      pts = views.map((v) => ({ ll: new google.maps.LatLng(v.lat, v.lng), stage: v.stage }));
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

    // Cheap per-frame re-pin + re-scale so the glow tracks pan + zoom; the
    // getImageData render stays gated to idle / data change / enable.
    draw() {
      const proj = this.getProjection();
      if (!proj) return;
      if (!this.anchorTL || !this.anchorBR) {
        this.refresh();
        return;
      }
      const pTL = proj.fromLatLngToDivPixel(this.anchorTL);
      const pBR = proj.fromLatLngToDivPixel(this.anchorBR);
      if (!pTL || !pBR) return;
      canvas.style.left = `${pTL.x}px`;
      canvas.style.top = `${pTL.y}px`;
      const scale = this.renderW > 0 ? (pBR.x - pTL.x) / this.renderW : 1;
      canvas.style.transform =
        scale > 0 && Number.isFinite(scale) ? `scale(${scale})` : 'none';
    }

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

      const left = sw.x - PAD;
      const top = ne.y - PAD;
      const w = Math.ceil(ne.x - sw.x) + PAD * 2;
      const h = Math.ceil(sw.y - ne.y) + PAD * 2;
      if (w <= 0 || h <= 0) return;
      canvas.style.left = `${left}px`;
      canvas.style.top = `${top}px`;
      this.anchorTL = proj.fromDivPixelToLatLng(new google.maps.Point(left, top));
      this.anchorBR = proj.fromDivPixelToLatLng(new google.maps.Point(left + w, top + h));
      this.renderW = w;
      canvas.style.transformOrigin = '0 0';
      canvas.style.transform = 'none';
      canvas.width = w; // also clears the canvas
      canvas.height = h;

      const inView = (x: number, y: number) =>
        x >= -RADIUS && y >= -RADIUS && x <= w + RADIUS && y <= h + RADIUS;

      // Pass 1 — not_knocked DENSITY → demand gradient (the cold-lead heat base).
      ctx.globalAlpha = POINT_ALPHA;
      for (const p of pts) {
        if (p.stage !== 'not_knocked') continue;
        const px = proj.fromLatLngToDivPixel(p.ll);
        if (!px) continue;
        const x = px.x - left;
        const y = px.y - top;
        if (!inView(x, y)) continue;
        ctx.drawImage(stamp, x - RADIUS, y - RADIUS);
      }
      ctx.globalAlpha = 1;
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 3; i < d.length; i += 4) {
        const a = d[i];
        if (!a) continue;
        const j = a * 4;
        d[i - 3] = lut[j];
        d[i - 2] = lut[j + 1];
        d[i - 1] = lut[j + 2];
        d[i] = Math.round(lut[j + 3] * OPACITY);
      }
      ctx.putImageData(img, 0, 0);

      // Pass 2 — every prospect with a SET stage glows its stage color, added
      // over the demand base (overlapping same-stage points intensify).
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = OPACITY;
      for (const p of pts) {
        if (p.stage === 'not_knocked') continue;
        const px = proj.fromLatLngToDivPixel(p.ll);
        if (!px) continue;
        const x = px.x - left;
        const y = px.y - top;
        if (!inView(x, y)) continue;
        ctx.drawImage(colorStampFor(STAGE_COLORS[p.stage]), x - RADIUS, y - RADIUS);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
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
  const viewsRef = useRef(views);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    if (!map) return;
    const overlay = createHeatOverlay();
    overlay.setMap(map);
    overlay.setData(viewsRef.current);
    overlay.setEnabled(enabledRef.current);
    overlayRef.current = overlay;
    const idle = map.addListener('idle', () => overlay.refresh());
    return () => {
      idle.remove();
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    viewsRef.current = views;
    overlayRef.current?.setData(views);
  }, [views]);

  useEffect(() => {
    enabledRef.current = enabled;
    overlayRef.current?.setEnabled(enabled);
  }, [enabled]);

  return null;
}
