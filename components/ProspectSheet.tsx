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

// External label for date/month fields: those inputs are always non-empty, so a
// floating MUI label sits on the border and reads as overlapping — put it above.
const fieldLabelSx = {
  display: 'block',
  mb: 0.75,
  fontSize: '0.9rem',
  fontWeight: 500,
  color: 'text.secondary',
} as const;

// Avoid the SSR useLayoutEffect warning while still measuring before paint.
const useIsoLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const GRABBER_PX = 34;
const maxHeight = () => (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.92;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

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

  // Continuous-drag sheet: height follows the finger between a measured collapsed
  // peek (name + stage + Save) and a max height. No detents / snapping.
  const height = useMotionValue(0);
  const minRef = useRef(320);
  const peekRef = useRef<HTMLDivElement>(null);

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

  // Measure the collapsed peek (through the Save button) and open at that height.
  useIsoLayout(() => {
    if (!view) return;
    const max = maxHeight();
    const peek = peekRef.current ? peekRef.current.offsetTop : max * 0.42;
    minRef.current = clamp(peek + GRABBER_PX + 8, 220, max);
    height.set(minRef.current);
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

  // Grabber drag: the sheet height tracks the finger 1:1.
  const onGrabPan = (_: PointerEvent, info: PanInfo) => {
    height.set(clamp(height.get() - info.delta.y, minRef.current, maxHeight()));
  };
  const onGrabPanEnd = (_: PointerEvent, info: PanInfo) => {
    const min = minRef.current;
    // Flick down at the bottom dismisses.
    if (height.get() <= min + 6 && info.velocity.y > 600) {
      close();
      return;
    }
    // Otherwise carry the release velocity into a spring settle (no snapping).
    const projected = clamp(height.get() - info.velocity.y * 0.12, min, maxHeight());
    animate(height, projected, {
      type: 'spring',
      stiffness: SPRING_SHEET.stiffness,
      damping: SPRING_SHEET.damping,
      velocity: -info.velocity.y,
    });
  };

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

          {/* sheet: spring slide-in; height is finger-driven while dragging the grabber */}
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
            {/* grabber = drag handle (height follows the finger) */}
            <motion.div
              onPan={onGrabPan}
              onPanEnd={onGrabPanEnd}
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
              sx={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                px: 2.5,
                pb: 'calc(var(--safe-bottom) + 20px)',
              }}
            >
              {/* --- Peek: identity + stage + Save (measured for the collapsed height) --- */}
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
              {/* Segmented stage selector with a fluid sliding indicator. */}
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

              {/* peek boundary marker (measured for the collapsed height) */}
              <Box ref={peekRef} aria-hidden sx={{ height: 0 }} />

              {/* --- Details: revealed continuously as you drag up --- */}
              <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  startIcon={<PhoneIcon />}
                  disabled={!view.phone}
                  component="a"
                  href={view.phone ? `tel:${view.phone}` : undefined}
                >
                  Call
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  startIcon={<DirectionsIcon />}
                  onClick={() => openDirections(view.address ?? `${view.lat},${view.lng}`)}
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

              <TextField
                label="Contact name"
                placeholder="e.g. Marie (director)"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                fullWidth
              />

              <TextField
                label="Current provider"
                placeholder="e.g. CleanPro, Jani-King, unknown"
                value={currentProvider}
                onChange={(e) => setCurrentProvider(e.target.value)}
                fullWidth
                sx={{ mt: 2.5 }}
              />

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

              <TextField
                label="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                sx={{ mt: 2.5 }}
              />

              <Box sx={{ mt: 2 }}>
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
