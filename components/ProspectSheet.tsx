'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { STAGES, STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR, type Stage } from '@/lib/stages';
import { ICP } from '@/lib/icp';
import { parseExpiry } from '@/lib/contracts';
import { openDirections } from '@/lib/directions';
import { SPRING_120, SPRING_SHEET } from '@/lib/motion';
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
const maxHeight = () => (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.92;
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

export default function ProspectSheet() {
  const { views, selectedId, setSelectedId, save } = useData();
  const view = views.find((v) => v.place_id === selectedId) ?? null;

  const [stage, setStage] = useState<Stage>('not_knocked');
  const [note, setNote] = useState('');
  const [contactName, setContactName] = useState('');
  const [currentProvider, setCurrentProvider] = useState('');
  const [contractExpiry, setContractExpiry] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Content scrolls only once fully expanded (iOS Maps); locked at peek/half.
  const [atFull, setAtFull] = useState(false);

  // Sheet height follows the finger while dragging the grabber; snaps to one of
  // three measured detents [peek, half, full] on release.
  const height = useMotionValue(0);
  const detentsRef = useRef<number[]>([320, 520, 720]);
  const peekRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

  // Load the selected prospect's current state into the editable draft.
  useEffect(() => {
    if (view) {
      setStage(view.stage);
      setNote(view.note ?? '');
      setContactName(view.contact_name ?? '');
      setCurrentProvider(view.current_provider ?? '');
      setContractExpiry(parseExpiry(view.contract_expiry) ?? '');
      setFollowUp(view.follow_up_date ?? '');
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
    setConfirmClear(false);
  }

  async function onSave() {
    if (!view) return;
    setSaving(true);
    try {
      await save(view.place_id, {
        stage,
        note: note.trim() ? note.trim() : null,
        contact_name: contactName.trim() ? contactName.trim() : null,
        current_provider: currentProvider.trim() ? currentProvider.trim() : null,
        contract_expiry: contractExpiry.trim() ? contractExpiry.trim() : null,
        follow_up_date: followUp || null,
      });
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
          {/* dim + slight map blur; tap to dismiss */}
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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING_SHEET}
            style={{
              position: 'relative',
              width: '100%',
              height,
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
                  </Typography>
                </Box>
                <Chip
                  label={STAGE_LABELS[view.stage]}
                  sx={{
                    bgcolor: STAGE_COLORS[view.stage],
                    color: STAGE_ON_COLOR[view.stage],
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                />
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
                      onClick={() => setStage(s)}
                      sx={{
                        position: 'relative',
                        appearance: 'none',
                        border: 0,
                        background: 'transparent',
                        borderRadius: 999,
                        px: 1.5,
                        minHeight: 36,
                        cursor: 'pointer',
                        font: 'inherit',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: selected ? STAGE_ON_COLOR[s] : 'text.primary',
                        transition: 'color 200ms ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {selected && (
                        <motion.div
                          layoutId="stage-indicator"
                          transition={SPRING_120}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 999,
                            background: STAGE_COLORS[s],
                            zIndex: 0,
                          }}
                        />
                      )}
                      <Box component="span" sx={{ position: 'relative', zIndex: 1 }}>
                        {STAGE_LABELS[s]}
                      </Box>
                    </Box>
                  );
                })}
              </Box>

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
