'use client';

import { Box, Typography, Card, CardActionArea, Chip, Stack } from '@mui/material';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import { useData } from './DataProvider';
import { STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR } from '@/lib/stages';
import { ICP } from '@/lib/icp';
import type { IcpType } from '@/lib/types';

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

export default function FollowUps({ onOpen }: { onOpen: () => void }) {
  const { views, setSelectedId } = useData();
  const today = todayStr();

  const items = views
    .filter((v) => v.follow_up_date)
    .sort((a, b) => (a.follow_up_date! < b.follow_up_date! ? -1 : 1));

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: 'background.default',
        overflowY: 'auto',
        pt: 'calc(var(--safe-top) + 8px)',
        px: 1.5,
        pb: 'calc(var(--safe-bottom) + 96px)',
      }}
    >
      <Typography variant="h6" sx={{ px: 1, py: 1.5 }}>
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
          {items.map((v) => {
            const overdue = v.follow_up_date! < today;
            const dueToday = v.follow_up_date === today;
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
                        {v.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {ICP[v.type as IcpType].label} · {v.neighborhood}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, fontWeight: 600, color: overdue ? OVERDUE : 'text.primary' }}
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
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
