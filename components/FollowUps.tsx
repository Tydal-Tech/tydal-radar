'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  Chip,
  Stack,
  IconButton,
  Button,
  Snackbar,
  SnackbarContent,
} from '@mui/material';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useData } from './DataProvider';
import SheetShell from './SheetShell';
import { SPRING_120 } from '@/lib/motion';
import { STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR } from '@/lib/stages';
import { ICP } from '@/lib/icp';
import { glassSx, glassCardSx } from '@/lib/glass';
import type { IcpType, ProspectView } from '@/lib/types';

const OVERDUE = '#d93025';

function todayStr() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
}

function formatDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function FollowUps({
  onOpen,
  onScroll,
}: {
  onOpen: () => void;
  onScroll?: () => void;
}) {
  const { views, setSelectedId, save } = useData();
  // The CSS prefers-reduced-motion blanket doesn't reach framer's JS springs,
  // so honor it here: render rows at rest (no offset, no stagger, no layout glide).
  const reduceMotion = useReducedMotion();
  const today = todayStr();
  // Holds the just-cleared follow-up so it can be restored via the Undo snackbar.
  const [undo, setUndo] = useState<{ id: string; name: string; date: string | null } | null>(null);

  const items = views
    .filter((v) => v.follow_up_date)
    .sort((a, b) => (a.follow_up_date! < b.follow_up_date! ? -1 : 1));

  // Clear only the follow-up date (same null-date path as the in-sheet clear);
  // stage/note/contact/provider/expiry and the pipeline record itself are kept.
  async function clearFollowUp(v: ProspectView) {
    setUndo({ id: v.place_id, name: v.name, date: v.follow_up_date });
    try {
      await save(v.place_id, { follow_up_date: null });
    } catch {
      // save() already surfaces the error and reverts its optimistic update.
      setUndo(null);
    }
  }

  async function undoClear() {
    if (!undo) return;
    const { id, date } = undo;
    setUndo(null);
    try {
      await save(id, { follow_up_date: date });
    } catch {
      // handled by save()
    }
  }

  return (
    <>
      <SheetShell onClose={onOpen} onScroll={onScroll} initialDetent="peek">
        <Box sx={{ px: 1.5, pb: 3 }}>
      <Typography variant="h6" sx={{ px: 1, pt: 0.5, pb: 1.5 }}>
        Follow-ups
      </Typography>

      {items.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            color: 'text.secondary',
            mt: 8,
          }}
        >
          <EventNoteOutlinedIcon sx={{ fontSize: 48, opacity: 0.5 }} />
          <Typography>No follow-ups scheduled</Typography>
          <Typography variant="body2">Set a follow-up date on a prospect to see it here.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {/* Entrance: cards spring up with a per-index stagger (capped at 8 so
              long lists never feel laggy). Exit: clearing a follow-up fades the
              card out while `layout` glides the remaining siblings up — both
              transform/opacity only, so no layout thrash. */}
          <AnimatePresence>
            {items.map((v, i) => {
              const overdue = v.follow_up_date! < today;
              const dueToday = v.follow_up_date === today;
              return (
                <motion.div
                  key={v.place_id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    transition: reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.16, ease: 'easeOut' },
                  }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { ...SPRING_120, delay: Math.min(i, 8) * 0.045 }
                  }
                >
                  <Card sx={{ ...glassCardSx, display: 'flex', alignItems: 'center' }}>
                    <CardActionArea
                      onClick={() => {
                        setSelectedId(v.place_id);
                        onOpen();
                      }}
                      sx={{ p: 1.75, flex: 1 }}
                    >
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {v.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {ICP[v.type as IcpType].label} · {v.neighborhood}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 0.5,
                              fontWeight: 600,
                              color: overdue ? OVERDUE : 'text.primary',
                            }}
                          >
                            {overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}
                            {formatDate(v.follow_up_date!)}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={STAGE_LABELS[v.stage]}
                          sx={{
                            alignSelf: 'flex-start',
                            bgcolor: STAGE_COLORS[v.stage],
                            color: STAGE_ON_COLOR[v.stage],
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        />
                      </Stack>
                    </CardActionArea>
                    <IconButton
                      aria-label={`Clear follow-up for ${v.name}`}
                      onClick={() => clearFollowUp(v)}
                      sx={{ mx: 0.5, flexShrink: 0, color: 'text.secondary' }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </Stack>
      )}
        </Box>
      </SheetShell>

      <Snackbar
        open={!!undo}
        autoHideDuration={5000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setUndo(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 'calc(var(--ui-bottom) + 80px)' }}
      >
        <SnackbarContent
          message={undo ? `Follow-up cleared — ${undo.name}` : ''}
          action={
            <Button color="secondary" size="small" onClick={undoClear} sx={{ fontWeight: 700 }}>
              Undo
            </Button>
          }
          sx={{ ...glassSx, bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2 }}
        />
      </Snackbar>
    </>
  );
}
