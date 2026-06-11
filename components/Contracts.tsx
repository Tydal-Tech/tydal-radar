'use client';

import { Box, Typography, Card, CardActionArea, Chip, Stack } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { useData } from './DataProvider';
import { STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR } from '@/lib/stages';
import { ICP, ICP_EMOJI } from '@/lib/icp';
import { parseExpiry, expiryStatus, formatExpiry, EXPIRY_COLOR } from '@/lib/contracts';
import type { IcpType, ProspectView } from '@/lib/types';

type Row = { v: ProspectView; ym: string | null };

export default function Contracts({ onOpen }: { onOpen: () => void }) {
  const { views, setSelectedId } = useData();

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
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: 'background.default',
        overflowY: 'auto',
        pt: 'calc(var(--safe-top) + 8px)',
        px: 1.5,
        pb: 'calc(var(--ui-bottom) + 80px)',
      }}
    >
      <Typography variant="h6" sx={{ px: 1, py: 1.5 }}>
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
          {rows.map(({ v, ym }) => {
            const status = ym ? expiryStatus(ym) : null;
            const color = status ? EXPIRY_COLOR[status.bucket] : '';
            return (
              <Card key={v.place_id} variant="outlined" sx={{ borderRadius: 3 }}>
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
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center' }}>
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
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
