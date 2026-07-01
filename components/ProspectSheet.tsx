'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  animate,
  type PanInfo,
} from 'framer-motion';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Button,
  IconButton,
  TextField,
  Divider,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import DirectionsIcon from '@mui/icons-material/Directions';
import ClearIcon from '@mui/icons-material/Clear';
import { useData } from './DataProvider';
import { useGeo } from './GeolocationProvider';
import { distanceMeters, formatDistance } from '@/lib/geo';
import {
  STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_ON_COLOR,
  LOST_REASONS,
  LOST_REASON_LABELS,
  type Stage,
  type LostReason,
} from '@/lib/stages';
import { ICP } from '@/lib/icp';
import { parseExpiry } from '@/lib/contracts';
import { leadScore, isNewlyOpened } from '@/lib/score';
import { buildIndex, coLocation } from '@/lib/buildings';
import { underwrite } from '@/lib/underwriting';
import { bestKnockTime } from '@/lib/timing';
import { pitch } from '@/lib/pitch';
import { expansionTargets } from '@/lib/expansion';
import { sameTypeNearby } from '@/lib/corridor';
import { openDirections } from '@/lib/directions';
import { SPRING_SHEET } from '@/lib/motion';
import { cssPx } from '@/lib/measure';
import type { IcpType } from '@/lib/types';

// External label above every field — MUI's floating label sits on the outline
// border in this build and reads as overlapping.
const fieldLabelSx = {
  display: 'block',
  mb: 0.75,
  fontSize: '0.9rem',
  fontWeight: 500,
  color: 'text.secondary',
} as const;

// Secondary action buttons (Call / Directions): high-contrast light outline +
// faint glass fill so they read clearly on the dark sheet next to the solid Save.
const actionBtnSx = {
  color: 'text.primary',
  borderColor: 'rgba(255,255,255,0.4)',
  bgcolor: 'rgba(255,255,255,0.05)',
  '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.1)' },
  '&.Mui-disabled': { color: 'rgba(255,255,255,0.32)', borderColor: 'rgba(255,255,255,0.14)' },
} as const;

const useIsoLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const GRABBER_PX = 34;
const maxHeight = () => {
  if (typeof window === 'undefined') return 800;
  const ih = window.innerHeight;
  // Keep the sheet's top clear of the top safe area (Dynamic Island / status bar).
  const topGuard = cssPx('calc(env(safe-area-inset-top, 0px) + 8px)');
  return Math.min(ih * 0.92, ih - topGuard);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Momentum-based snap: a flick carries one detent in its direction; a slow
// release snaps to the nearest detent by position. `detents` is ascending.
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

// Scroll the currently-focused field into view within `container` (the sheet's
// scroller). The marginBottom:kbInset lift puts the scroller's bottom at the
// keyboard's top, so this reveals the focused input above the keyboard — iOS
// won't do it reliably for a custom scroller inside a transformed sheet, and
// AppShell pins window scroll to 0 on focus.
function scrollActiveIntoView(container: HTMLElement | null) {
  const a = document.activeElement as HTMLElement | null;
  if (a && container && container.contains(a)) {
    requestAnimationFrame(() => a.scrollIntoView({ block: 'center' }));
  }
}

export default function ProspectSheet() {
  const { views, selectedId, setSelectedId, save } = useData();
  const { position } = useGeo();
  const view = views.find((v) => v.place_id === selectedId) ?? null;
  const buildingIndex = useMemo(() => buildIndex(views), [views]);
  const co = view ? coLocation(buildingIndex, view) : null;
  const uw = view ? underwrite(view, position ?? undefined) : null;
  const knock = view ? bestKnockTime(view.type) : null;
  const talk = view ? pitch(view, co ?? undefined) : null;
  // Memoized: these scan all prospects (O(n)), so without this they'd re-run on
  // every keystroke in the note/contact fields (this sheet re-renders per input).
  const expansion = useMemo(
    () => (view && view.stage === 'client' ? expansionTargets(view, views) : null),
    [view, views],
  );
  const corridor = useMemo(() => (view ? sameTypeNearby(view, views) : []), [view, views]);

  const [stage, setStage] = useState<Stage>('not_knocked');
  const [note, setNote] = useState('');
  const [contactName, setContactName] = useState('');
  const [currentProvider, setCurrentProvider] = useState('');
  const [contractExpiry, setContractExpiry] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Content scrolls only once fully expanded (iOS Maps); locked at peek/half.
  const [atFull, setAtFull] = useState(false);
  // Keyboard height (visual-viewport shrink) — lifts the sheet above the iOS
  // keyboard so the lower fields (note / expiry / follow-up) stay visible.
  const [kbInset, setKbInset] = useState(0);

  // Sheet height follows the finger while dragging the grabber; snaps to one of
  // three measured detents [peek, half, full] on release.
  const height = useMotionValue(0);
  const detentsRef = useRef<number[]>([320, 520, 720]);
  const peekRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const atFullRef = useRef(atFull);
  useEffect(() => {
    atFullRef.current = atFull;
  });
  const dragRef = useRef<{
    startY: number;
    startH: number;
    dragging: boolean;
    lastY: number;
    lastT: number;
    vy: number;
  } | null>(null);

  // Load the selected prospect's current state into the editable draft.
  useEffect(() => {
    if (view) {
      setStage(view.stage);
      setNote(view.note ?? '');
      setContactName(view.contact_name ?? '');
      setCurrentProvider(view.current_provider ?? '');
      setContractExpiry(parseExpiry(view.contract_expiry) ?? '');
      setFollowUp(view.follow_up_date ?? '');
      setLostReason((view.lost_reason as LostReason) || '');
      setConfirmClear(false);
    }
  }, [view]);

  // Measure the three detents and open at the peek.
  useIsoLayout(() => {
    if (!view) return;
    const max = maxHeight();
    const peek = clamp((peekRef.current?.offsetTop ?? max * 0.34) + GRABBER_PX + 8, 220, max);
    const half = clamp((halfRef.current?.offsetTop ?? max * 0.6) + GRABBER_PX + 8, peek, max);
    const full = clamp(GRABBER_PX + (contentRef.current?.scrollHeight ?? max), half, max);
    detentsRef.current = [peek, half, full];
    height.set(peek);
    setAtFull(false);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [view]);

  // The Lost-reason picker shows/hides with the stage, changing content height —
  // re-measure the detents, and if Lost was just picked from a collapsed sheet,
  // open to half so the reason chips (and Save) come into view.
  useIsoLayout(() => {
    if (!view) return;
    const max = maxHeight();
    const peek = clamp((peekRef.current?.offsetTop ?? max * 0.34) + GRABBER_PX + 8, 220, max);
    const half = clamp((halfRef.current?.offsetTop ?? max * 0.6) + GRABBER_PX + 8, peek, max);
    const full = clamp(GRABBER_PX + (contentRef.current?.scrollHeight ?? max), half, max);
    detentsRef.current = [peek, half, full];
    if (stage === 'lost' && height.get() < half - 1) {
      animate(height, half, {
        type: 'spring',
        stiffness: SPRING_SHEET.stiffness,
        damping: SPRING_SHEET.damping,
      });
      setAtFull(false);
    }
     
  }, [stage]);

  // Auto-cancel the "Clear all" confirm so a stray earlier tap can't wipe data later.
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const close = () => setSelectedId(null);

  // Close on Escape (desktop / external keyboard).
  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);

  // Track the keyboard inset (visual-viewport shrink) so the sheet can lift above
  // it, and when the keyboard opens, scroll the focused field above it — the lift
  // alone leaves the field wherever the scroller happened to be.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => setKbInset(Math.max(0, window.innerHeight - vv.height));
    const onResize = () => {
      sync();
      if (window.innerHeight - vv.height > 0) scrollActiveIntoView(contentRef.current);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', sync);
    sync();
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', sync);
    };
  }, []);

  // Resize the sheet by a framer pan delta (used by the grabber).
  const resizeBy = (info: PanInfo) => {
    const d = detentsRef.current;
    height.set(clamp(height.get() - info.delta.y, d[0], d[d.length - 1]));
  };
  // On release, momentum-snap to a detent (or dismiss on a hard flick at peek).
  const snapWithVelocity = (vy: number) => {
    const d = detentsRef.current;
    const h = height.get();
    if (vy > 800 && h <= d[0] + 10) {
      close();
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

  // Card-surface drag with native-scroll handoff. Non-passive so we can take the
  // gesture over from the scroller. Peek/Half: any drag resizes. Full: only a
  // downward pull from the very top hands off to a collapse — otherwise the
  // content scrolls natively.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !view) return;
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
          // Hand off only when pulling down from the very top of the scroll.
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
  }, [view]);

  // Reset the editable draft to a blank prospect. Persisted only when the user taps Save.
  function clearAll() {
    setStage('not_knocked');
    setNote('');
    setContactName('');
    setCurrentProvider('');
    setContractExpiry('');
    setFollowUp('');
    setLostReason('');
    setConfirmClear(false);
  }

  // The full editable draft as a save patch for a given stage (lost_reason only
  // sticks while the stage is "lost").
  const buildPatch = (s: Stage) => ({
    stage: s,
    note: note.trim() ? note.trim() : null,
    contact_name: contactName.trim() ? contactName.trim() : null,
    current_provider: currentProvider.trim() ? currentProvider.trim() : null,
    contract_expiry: contractExpiry.trim() ? contractExpiry.trim() : null,
    follow_up_date: followUp || null,
    lost_reason: s === 'lost' ? (lostReason || null) : null,
  });

  async function onSave() {
    if (!view) return;
    setSaving(true);
    try {
      await save(view.place_id, buildPatch(stage));
      close();
    } finally {
      setSaving(false);
    }
  }

  // One-tap stage change: commit the card with the tapped stage and close, so a
  // quick "mark knocked/talked" is a single tap. "lost" is the exception — it
  // reveals the reason picker to fill in before Save.
  async function bumpStage(s: Stage) {
    setStage(s);
    if (s === 'lost' || !view) return;
    setSaving(true);
    try {
      await save(view.place_id, buildPatch(s));
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {view && (
        <Box
          key="prospect-sheet"
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          {/* dim scrim; tap to dismiss */}
          <motion.div
            className="tydal-sheet-backdrop"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0 }}
          />

          {/* sheet: spring slide-in; height is finger-driven, snaps to detents */}
          <motion.div
            className="tydal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={view.name}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING_SHEET}
            style={{
              position: 'relative',
              width: '100%',
              height,
              // Ride above the keyboard when it's open so bottom fields stay visible.
              marginBottom: kbInset,
              transition: 'margin-bottom 0.25s ease',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* grabber = drag handle (always resizes, even from Full) */}
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
              <Box sx={{ width: 38, height: 5, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.4)' }} />
            </motion.div>

            <Box
              ref={contentRef}
              // Keyboard already open and focus moved to another field: keep it
              // above the keyboard (a visualViewport resize won't fire when the
              // keyboard height is unchanged).
              onFocusCapture={() => {
                if (kbInset > 0) scrollActiveIntoView(contentRef.current);
              }}
              sx={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                overflowY: atFull ? 'auto' : 'hidden',
                overscrollBehavior: 'contain',
                px: 2.5,
                pb: 'calc(var(--safe-bottom) + 20px)',
                // Peek/Half: drags resize (handled via touch). Full: native scroll.
                touchAction: atFull ? 'pan-y' : 'none',
              }}
            >
              {/* ---- PEEK: identity + stage + Save ---- */}
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2 }}>
                    {view.name}
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: '1rem', color: 'text.secondary' }}>
                    {ICP[view.type as IcpType].label} · {view.neighborhood}
                    {position ? ` · ${formatDistance(distanceMeters(position, view))}` : ''}
                  </Typography>
                  {view.rating != null && (
                    <Typography sx={{ mt: 0.25, fontSize: '0.95rem', color: 'text.secondary' }}>
                      ★ {view.rating.toFixed(1)}
                      {view.user_rating_count
                        ? ` · ${view.user_rating_count} review${view.user_rating_count === 1 ? '' : 's'}`
                        : ''}
                    </Typography>
                  )}
                  {view.website && (
                    <Typography
                      component="a"
                      href={view.website}
                      target="_blank"
                      rel="noopener"
                      sx={{ mt: 0.25, display: 'inline-block', fontSize: '0.9rem', color: 'primary.main' }}
                    >
                      Website ↗
                    </Typography>
                  )}
                  {co?.known && (
                    <Typography
                      sx={{ mt: 0.5, fontSize: '0.85rem', color: co.soleOccupant ? '#34c759' : 'text.secondary' }}
                    >
                      {co.soleOccupant
                        ? '🏠 Sole occupant · controls its own cleaning'
                        : `🏢 Shares this address with ${co.count - 1} other business${co.count - 1 === 1 ? '' : 'es'} · cleaning likely handled by the property manager`}
                    </Typography>
                  )}
                </Box>
                <Stack spacing={0.75} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  {isNewlyOpened(view.first_seen) && (
                    <Chip
                      size="small"
                      label="✦ New"
                      title="First seen recently — likely no cleaning contract yet"
                      sx={{ bgcolor: '#34c759', color: '#00250e', fontWeight: 700 }}
                    />
                  )}
                  <Chip
                    label={STAGE_LABELS[view.stage]}
                    sx={{
                      bgcolor: STAGE_COLORS[view.stage],
                      color: STAGE_ON_COLOR[view.stage],
                      fontWeight: 600,
                    }}
                  />
                  {(() => {
                    const score = leadScore(view).score;
                    const color =
                      score >= 60 ? '#ff6b35' : score >= 40 ? '#f9ab00' : 'rgba(255,255,255,0.45)';
                    return (
                      <Chip
                        size="small"
                        label={`Lead ${score}`}
                        title="Lead score (higher = work first)"
                        sx={{
                          bgcolor: 'transparent',
                          border: `1px solid ${color}`,
                          color,
                          fontWeight: 700,
                        }}
                      />
                    );
                  })()}
                  {uw && (
                    <Chip
                      size="small"
                      label={`Value ${uw.valueBand}`}
                      title={`Est. contract ~$${uw.value}/mo`}
                      sx={{
                        bgcolor: 'transparent',
                        border: '1px solid #34c759',
                        color: '#34c759',
                        fontWeight: 700,
                      }}
                    />
                  )}
                </Stack>
              </Stack>

              <Typography sx={{ mt: 2.5, mb: 1, fontSize: '1rem', fontWeight: 600 }}>
                Stage
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  p: 0.75,
                  borderRadius: '18px',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {STAGES.map((s) => {
                  const selected = s === stage;
                  return (
                    <Box
                      key={s}
                      component="button"
                      type="button"
                      onClick={() => bumpStage(s)}
                      sx={{
                        appearance: 'none',
                        border: 0,
                        borderRadius: 999,
                        px: 1.5,
                        minHeight: 36,
                        cursor: 'pointer',
                        font: 'inherit',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        // The selected color lives on the button itself (no shared
                        // layout indicator) so it paints on the FIRST tap — iOS was
                        // leaving the animated indicator a stale grey until a scroll
                        // forced a repaint.
                        bgcolor: selected ? STAGE_COLORS[s] : 'transparent',
                        color: selected ? STAGE_ON_COLOR[s] : 'text.primary',
                        transition: 'background-color 200ms ease, color 200ms ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {STAGE_LABELS[s]}
                    </Box>
                  );
                })}
              </Box>

              {/* ---- Playbook: how to work this door (best time · opener · angles) ---- */}
              {talk && (
                <Box
                  sx={{
                    mt: 2.5,
                    p: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'rgba(52,199,89,0.08)',
                    border: '1px solid rgba(52,199,89,0.25)',
                  }}
                >
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, mb: 0.5 }}>
                    Playbook
                  </Typography>
                  {knock && (
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 0.75 }}>
                      🕑 Best time: <b>{knock.window}</b> — {knock.why}
                    </Typography>
                  )}
                  {corridor.length > 0 && (
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 0.75 }}>
                      📍 {corridor.length} more {ICP[view.type as IcpType].label} within ~400 m —
                      pitch them in one loop
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.9rem', fontStyle: 'italic', mb: 0.5 }}>
                    “{talk.opener}”
                  </Typography>
                  {talk.angles.length > 0 && (
                    <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                      {talk.angles.map((a, i) => (
                        <Typography
                          key={i}
                          component="li"
                          sx={{ fontSize: '0.82rem', color: 'text.secondary' }}
                        >
                          {a}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {/* ---- Expansion: warm targets once this is a client ---- */}
              {expansion && (expansion.sameBuilding.length > 0 || expansion.sisters.length > 0) && (
                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'rgba(90,200,250,0.08)',
                    border: '1px solid rgba(90,200,250,0.25)',
                  }}
                >
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, mb: 0.5 }}>
                    Grow from this client
                  </Typography>
                  {expansion.sameBuilding.length > 0 && (
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 0.5 }}>
                      🏢 {expansion.sameBuilding.length} more business
                      {expansion.sameBuilding.length === 1 ? '' : 'es'} in this building —{' '}
                      {expansion.sameBuilding
                        .slice(0, 3)
                        .map((p) => p.name)
                        .join(', ')}
                      {expansion.sameBuilding.length > 3 ? '…' : ''}
                    </Typography>
                  )}
                  {expansion.sisters.length > 0 && (
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                      🔗 {expansion.sisters.length} sister location
                      {expansion.sisters.length === 1 ? '' : 's'} of the same chain — ask for a
                      referral.
                    </Typography>
                  )}
                </Box>
              )}

              {stage === 'lost' && (
                <>
                  <Typography sx={{ mt: 2.5, mb: 1, fontSize: '1rem', fontWeight: 600 }}>
                    Lost reason
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {LOST_REASONS.map((r) => {
                      const selected = r === lostReason;
                      return (
                        <Chip
                          key={r}
                          label={LOST_REASON_LABELS[r]}
                          onClick={() => setLostReason(selected ? '' : r)}
                          className={selected ? 'tydal-pop' : undefined}
                          sx={{
                            fontWeight: 600,
                            bgcolor: selected ? STAGE_COLORS.lost : 'rgba(255,255,255,0.06)',
                            color: selected ? '#fff' : 'text.primary',
                            border: '1px solid rgba(255,255,255,0.1)',
                            '&:hover': {
                              bgcolor: selected ? STAGE_COLORS.lost : 'rgba(255,255,255,0.12)',
                            },
                          }}
                        />
                      );
                    })}
                  </Box>
                </>
              )}

              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={onSave}
                disabled={saving}
                sx={{ mt: 2.5 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>

              <Box ref={peekRef} aria-hidden sx={{ height: 0 }} />

              {/* ---- HALF: actions + address + contact + provider ---- */}
              <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  startIcon={<PhoneIcon />}
                  disabled={!view.phone}
                  component="a"
                  href={view.phone ? `tel:${view.phone}` : undefined}
                  sx={actionBtnSx}
                >
                  Call
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  startIcon={<DirectionsIcon />}
                  onClick={() => openDirections(view.address ?? `${view.lat},${view.lng}`)}
                  sx={actionBtnSx}
                >
                  Directions
                </Button>
              </Stack>

              {view.address && (
                <Typography sx={{ mt: 2, fontSize: '1rem', color: 'text.secondary' }}>
                  {view.address}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Box>
                <Typography component="label" htmlFor="contact-name" sx={fieldLabelSx}>
                  Contact name
                </Typography>
                <TextField
                  id="contact-name"
                  placeholder="e.g. Marie (director)"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  fullWidth
                />
              </Box>

              <Box sx={{ mt: 2.5 }}>
                <Typography component="label" htmlFor="current-provider" sx={fieldLabelSx}>
                  Current provider
                </Typography>
                <TextField
                  id="current-provider"
                  placeholder="e.g. CleanPro, Jani-King, unknown"
                  value={currentProvider}
                  onChange={(e) => setCurrentProvider(e.target.value)}
                  fullWidth
                />
              </Box>

              <Box ref={halfRef} aria-hidden sx={{ height: 0 }} />

              {/* ---- FULL: expiry + note + follow-up + clear ---- */}
              <Box sx={{ mt: 2.5 }}>
                <Typography component="label" htmlFor="contract-expiry" sx={fieldLabelSx}>
                  Contract expiry
                </Typography>
                <TextField
                  id="contract-expiry"
                  type="month"
                  value={contractExpiry}
                  onChange={(e) => setContractExpiry(e.target.value)}
                  fullWidth
                />
              </Box>

              <Box sx={{ mt: 2.5 }}>
                <Typography component="label" htmlFor="note" sx={fieldLabelSx}>
                  Note
                </Typography>
                <TextField
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Box>

              <Box sx={{ mt: 2.5 }}>
                <Typography component="label" htmlFor="follow-up" sx={fieldLabelSx}>
                  Follow-up date
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TextField
                    id="follow-up"
                    type="date"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    fullWidth
                  />
                  {followUp && (
                    <IconButton aria-label="Clear follow-up date" onClick={() => setFollowUp('')}>
                      <ClearIcon />
                    </IconButton>
                  )}
                </Stack>
              </Box>

              <Button
                variant="text"
                size="small"
                fullWidth
                disableRipple
                onClick={() => (confirmClear ? clearAll() : setConfirmClear(true))}
                sx={{
                  mt: 1.5,
                  fontWeight: 400,
                  color: confirmClear ? 'error.main' : 'text.secondary',
                }}
              >
                {confirmClear ? 'Tap again to clear all' : 'Clear all'}
              </Button>
            </Box>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  );
}
