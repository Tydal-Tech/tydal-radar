'use client';

import { Box, Typography, Card, CardActionArea, Chip, Stack } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { motion, useReducedMotion } from 'framer-motion';
import { useData } from './DataProvider';
import SheetShell from './SheetShell';
import { SPRING_120 } from '@/lib/motion';
import { STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR } from '@/lib/stages';
import { ICP_EMOJI } from '@/lib/icp';
import { parseExpiry, expiryStatus, formatExpiry, EXPIRY_COLOR } from '@/lib/contracts';
import { glassCardSx } from '@/lib/glass';
import type { IcpType, ProspectView } from '@/lib/types';

type Row = { v: ProspectView; ym: string | null };

export default function Contracts({
  onOpen,
  onScroll,
}: {
  onOpen: () => void;
  onScroll?: () => void;
}) {
  const { views, setSelectedId } = useData();
  // The CSS prefers-reduced-motion blanket doesn't reach framer's JS springs,
  // so honor it here: render rows at rest (no offset, no stagger).
  const reduceMotion = useReducedMotion();

  // Every prospect with a non-empty contract_expiry, parsed to YYYY-MM where we
  // can. Parseable rows sort by expiry ascending (soonest first); unparseable
  // ("fix date") rows fall to the end so they don't bury urgent renewals.
  const rows: Row[] = views
    .filter((v) => v.contract_expiry?.trim())
    .map((v) => ({ v, ym: parseExpiry(v.contract_expiry) }))
    .sort((a, b) => {
      if (a.ym && b.ym) return a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : 0;
      if (a.ym) return -1;
      if (b.ym) return 1;
      return 0;
    });

  return (
    <SheetShell onClose={onOpen} onScroll={onScroll} initialDetent="peek">
      <Box sx={{ px: 1.5, pb: 3 }}>
      <Typography variant="h6" sx={{ px: 1, pt: 0.5, pb: 1.5 }}>
        Contracts
      </Typography>

      {rows.length === 0 ? (
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
          <DescriptionOutlinedIcon sx={{ fontSize: 48, opacity: 0.5 }} />
          <Typography>No contracts tracked</Typography>
          <Typography variant="body2">
            Set a contract expiry on a prospect to see it here.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {/* Entrance: cards spring up with a per-index stagger, capped at 8 so
              long lists never feel laggy. Transform/opacity only. */}
          {rows.map(({ v, ym }, i) => {
            const status = ym ? expiryStatus(ym) : null;
            const color = status ? EXPIRY_COLOR[status.bucket] : '';
            return (
              <motion.div
                key={v.place_id}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { ...SPRING_120, delay: Math.min(i, 8) * 0.045 }
                }
              >
                <Card sx={glassCardSx}>
                  <CardActionArea
                    onClick={() => {
                      setSelectedId(v.place_id);
                      onOpen();
                    }}
                    sx={{ p: 1.75 }}
                  >
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          <span aria-hidden style={{ marginRight: 6 }}>
                            {ICP_EMOJI[v.type as IcpType]}
                          </span>
                          {v.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {v.neighborhood} · {v.current_provider?.trim() || 'Provider unknown'}
                        </Typography>
                        {ym ? (
                          <Typography
                            variant="body2"
                            sx={{ mt: 0.5, fontWeight: 600, color: color || 'text.primary' }}
                          >
                            {status && status.daysUntil < 0 ? 'Expired · ' : 'Expires '}
                            {formatExpiry(ym)}
                          </Typography>
                        ) : (
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ mt: 0.5, alignItems: 'center' }}
                          >
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {v.contract_expiry}
                            </Typography>
                            <Chip
                              size="small"
                              label="Fix date"
                              sx={{
                                bgcolor: EXPIRY_COLOR.amber,
                                color: '#1a1f36',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            />
                          </Stack>
                        )}
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
                </Card>
              </motion.div>
            );
          })}
        </Stack>
      )}
      </Box>
    </SheetShell>
  );
}
