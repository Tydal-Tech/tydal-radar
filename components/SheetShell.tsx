'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion';
import { SPRING_SHEET } from '@/lib/motion';

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

// Three-detent pull-up sheet (Peek / Half / Full) — the same behavior as the
// prospect card: drag the grabber, or the content with a native-scroll handoff
// at Full, to resize; momentum snaps to a detent; a hard flick down at Peek
// dismisses. The sheet is anchored above the nav bar and grows upward; content
// scrolls only once Full (locked at Peek/Half so a drag resizes instead).
export default function SheetShell({
  onClose,
  onScroll,
  children,
}: {
  onClose: () => void;
  onScroll?: () => void;
  children: ReactNode;
}) {
  const height = useMotionValue(0);
  const detentsRef = useRef<number[]>([300, 480, 700]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [atFull, setAtFull] = useState(false);
  const atFullRef = useRef(atFull);
  atFullRef.current = atFull;
  const dragRef = useRef<{
    startY: number;
    startH: number;
    dragging: boolean;
    lastY: number;
    lastT: number;
    vy: number;
  } | null>(null);

  // Measure the three detents from the viewport and open at Peek.
  useIsoLayout(() => {
    const vh = window.innerHeight;
    const peek = clamp(vh * 0.4, 240, vh);
    const half = clamp(vh * 0.62, peek, vh);
    const full = clamp(vh * 0.9, half, vh);
    detentsRef.current = [peek, half, full];
    height.set(peek);
    setAtFull(false);
    if (contentRef.current) contentRef.current.scrollTop = 0;
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
        bottom: 'var(--nav-total)',
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
