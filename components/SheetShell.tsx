'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { motion, useMotionValue, useMotionValueEvent, animate, type PanInfo } from 'framer-motion';
import { SPRING_SHEET } from '@/lib/motion';
import { cssPx } from '@/lib/measure';
import { useSheetHeight } from './SheetHeightContext';

const useIsoLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Momentum-based snap (same as the prospect card): a flick carries one detent in
// its direction; a slow release snaps to the nearest detent by position.
function snapTarget(h: number, vy: number, detents: number[]): number {
  const FLICK = 450;
  if (vy < -FLICK) {
    const up = detents.filter((d) => d > h + 1);
    return up.length ? Math.min(...up) : Math.max(...detents);
  }
  if (vy > FLICK) {
    const down = detents.filter((d) => d < h - 1);
    return down.length ? Math.max(...down) : Math.min(...detents);
  }
  return detents.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a));
}

// The three detent fractions of the VISUAL viewport height (the area that
// actually shrinks when the iOS keyboard opens), with peek floored at 240px.
function measureDetents(): number[] {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const peek = clamp(vh * 0.4, 240, vh);
  const half = clamp(vh * 0.62, peek, vh);
  // The sheet is bottom-anchored (bottom: var(--nav-total)) and grows up — cap
  // Full so its TOP clears the nav + the top safe area (Dynamic Island / status
  // bar) instead of sliding under it. env(safe-area-inset-top) is 0 without one.
  const topGuard = cssPx('calc(var(--nav-total) + env(safe-area-inset-top, 0px) + 8px)');
  const full = clamp(vh * 0.9, half, vh - topGuard);
  return [peek, half, full];
}

const DETENT_INDEX = { peek: 0, half: 1, full: 2 } as const;

// Three-detent pull-up sheet (Peek / Half / Full) — the same behavior as the
// prospect card: drag the grabber, or the content with a native-scroll handoff
// at Full, to resize; momentum snaps to a detent; a hard flick down at Peek
// dismisses. The sheet is anchored above the nav bar and grows upward; content
// scrolls only once Full (locked at Peek/Half so a drag resizes instead).
// `header` renders fixed (non-scrolling) between the grabber and the content.
export default function SheetShell({
  onClose,
  onScroll,
  header,
  initialDetent = 'half',
  children,
}: {
  onClose: () => void;
  onScroll?: () => void;
  header?: ReactNode;
  initialDetent?: 'peek' | 'half' | 'full';
  children: ReactNode;
}) {
  const height = useMotionValue(0);
  const detentsRef = useRef<number[]>([300, 480, 700]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [atFull, setAtFull] = useState(false);
  const atFullRef = useRef(atFull);
  atFullRef.current = atFull;
  // Keyboard height (how far the visual viewport shrank below the layout
  // viewport). The shell stays full-height (static), so only THIS sheet lifts
  // above the keyboard by anchoring its bottom here instead of at the nav.
  const [kbInset, setKbInset] = useState(0);
  // Publish our live height to the shared context so the map's floating controls
  // anchor to this sheet's top edge as it drags/snaps (reset to 0 on close).
  const sharedHeight = useSheetHeight();
  useMotionValueEvent(height, 'change', (h) => sharedHeight?.set(h));
  useEffect(() => {
    sharedHeight?.set(height.get());
    return () => sharedHeight?.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    dragging: boolean;
    lastY: number;
    lastT: number;
    vy: number;
  } | null>(null);

  // Measure the three detents from the visual viewport and open at initialDetent.
  useIsoLayout(() => {
    const d = measureDetents();
    detentsRef.current = d;
    const idx = DETENT_INDEX[initialDetent];
    height.set(d[idx]);
    setAtFull(idx === d.length - 1);
    if (contentRef.current) contentRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute the detents when the visual viewport resizes (iOS keyboard
  // open/close, URL-bar collapse) and move the sheet to the SAME detent at its
  // new size — so when the keyboard shrinks the viewport, the sheet (and any
  // fixed header field) shrink with it and stay above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onVvResize = () => {
      const old = detentsRef.current;
      const h = height.get();
      // Which detent are we (nearest) at right now?
      let idx = 0;
      for (let i = 1; i < old.length; i++) {
        if (Math.abs(old[i] - h) < Math.abs(old[idx] - h)) idx = i;
      }
      const d = measureDetents();
      detentsRef.current = d;
      height.set(d[idx]);
      setAtFull(idx === d.length - 1);
    };
    vv.addEventListener('resize', onVvResize);
    return () => vv.removeEventListener('resize', onVvResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the keyboard inset (visual viewport shrink) and lift the sheet above it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKbInset(Math.max(0, window.innerHeight - vv.height));
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  // Resize by a framer pan delta (the grabber).
  const resizeBy = (info: PanInfo) => {
    const d = detentsRef.current;
    height.set(clamp(height.get() - info.delta.y, d[0], d[d.length - 1]));
  };
  // On release, momentum-snap to a detent (or dismiss on a hard flick at Peek).
  const snapWithVelocity = (vy: number) => {
    const d = detentsRef.current;
    const h = height.get();
    if (vy > 800 && h <= d[0] + 10) {
      onClose();
      return;
    }
    const target = snapTarget(h, vy, d);
    animate(height, target, {
      type: 'spring',
      stiffness: SPRING_SHEET.stiffness,
      damping: SPRING_SHEET.damping,
      velocity: -vy,
    });
    setAtFull(target === d[d.length - 1]);
    if (target !== d[d.length - 1] && contentRef.current) contentRef.current.scrollTop = 0;
  };
  // Grabbing the handle always resizes — lock scroll first (even from Full).
  const lockScroll = () => {
    setAtFull(false);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };

  // Content-surface drag with native-scroll handoff. Non-passive so we can take
  // the gesture over from the scroller. Peek/Half: any drag resizes. Full: only
  // a downward pull from the very top collapses — otherwise the list scrolls.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      dragRef.current = {
        startY: t.clientY,
        startH: height.get(),
        dragging: false,
        lastY: t.clientY,
        lastT: performance.now(),
        vy: 0,
      };
    };
    const onMove = (e: TouchEvent) => {
      const g = dragRef.current;
      if (!g) return;
      const t = e.touches[0];
      const dy = t.clientY - g.startY;
      const now = performance.now();
      g.vy = (t.clientY - g.lastY) / Math.max((now - g.lastT) / 1000, 0.001);
      g.lastY = t.clientY;
      g.lastT = now;
      if (!g.dragging) {
        if (atFullRef.current) {
          if (dy > 0 && el.scrollTop <= 0) {
            g.dragging = true;
            g.startH = height.get();
            setAtFull(false);
          } else {
            return; // let the content scroll
          }
        } else if (Math.abs(dy) > 3) {
          g.dragging = true;
        } else {
          return;
        }
      }
      e.preventDefault();
      const d = detentsRef.current;
      height.set(clamp(g.startH - dy, d[0], d[d.length - 1]));
    };
    const onEnd = () => {
      const g = dragRef.current;
      dragRef.current = null;
      if (g && g.dragging) snapWithVelocity(g.vy);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING_SHEET}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        // Lift above the keyboard when it's open; otherwise sit above the nav.
        bottom: kbInset > 0 ? `${kbInset}px` : 'var(--nav-total)',
        transition: 'bottom 0.25s ease',
        height,
        background: '#1a1a1a',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        boxShadow: '0 -8px 30px rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1100,
      }}
    >
      {/* Grabber = drag handle (always resizes, even from Full). */}
      <motion.div
        onPanStart={lockScroll}
        onPan={(_, info) => resizeBy(info)}
        onPanEnd={(_, info) => snapWithVelocity(info.velocity.y)}
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 11,
          paddingBottom: 7,
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <Box sx={{ width: 40, height: 5, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.25)' }} />
      </motion.div>
      {/* Fixed (non-scrolling) header between the grabber and the content —
          e.g. Search's field, which must stay visible at every detent. */}
      {header != null && <Box sx={{ flexShrink: 0 }}>{header}</Box>}
      <Box
        ref={contentRef}
        onScroll={onScroll}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: atFull ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          touchAction: atFull ? 'pan-y' : 'none',
        }}
      >
        {children}
      </Box>
    </motion.div>
  );
}
