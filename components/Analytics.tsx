'use client';

import { Box, Typography, Stack, Divider } from '@mui/material';
import { useData } from './DataProvider';
import SheetShell from './SheetShell';
import {
  funnel,
  weeklyActivity,
  conversions,
  byNeighborhood,
  lostReasons,
  LOST_GATE,
} from '@/lib/analytics';
import { STAGE_COLORS, LOST_REASON_LABELS } from '@/lib/stages';

// iOS-26 "liquid glass" card: translucent dark fill + a hairline top highlight +
// soft depth. Safe to blur here — the sheet is static, not over the live map.
const cardSx = {
  borderRadius: 4,
  p: 2,
  bgcolor: 'rgba(30,30,32,0.66)',
  backdropFilter: 'blur(20px) saturate(1.5)',
  WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.12) inset, 0 10px 30px rgba(0,0,0,0.45)',
} as const;

const tnum = { fontVariantNumeric: 'tabular-nums' } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ ...cardSx, mb: 1.75 }}>
      <Typography
        sx={{
          fontSize: '0.74rem',
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          mb: 1.25,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function NotEnough({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ color: 'text.secondary', fontSize: '0.88rem', py: 0.5, lineHeight: 1.45 }}>
      {children}
    </Typography>
  );
}

// A labelled proportional bar (funnel rows + lost-reason rows).
function Bar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 && count > 0 ? Math.max(6, (count / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, ...tnum }}>{count}</Typography>
      </Stack>
      <Box sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: color,
            transition: 'width 420ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </Box>
    </Box>
  );
}

function Delta({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <Box sx={{ minWidth: 46, textAlign: 'right', color: 'text.secondary', fontSize: '0.82rem' }}>
        —
      </Box>
    );
  }
  const up = delta > 0;
  return (
    <Box
      sx={{
        minWidth: 46,
        textAlign: 'right',
        fontSize: '0.82rem',
        fontWeight: 700,
        color: up ? '#34c759' : '#ff453a',
        ...tnum,
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </Box>
  );
}

export default function Analytics({
  onClose,
  onScroll,
}: {
  onClose: () => void;
  onScroll?: () => void;
}) {
  const { views } = useData();

  const f = funnel(views);
  const funnelMax = f.knocked || 1;
  const weeks = weeklyActivity(views);
  const anyWeekly = weeks.some((w) => w.thisWeek || w.lastWeek);
  const conv = conversions(f);
  const nbs = byNeighborhood(views);
  const lr = lostReasons(views);
  const lrMax = Math.max(1, ...lr.rows.map((r) => r.count));

  return (
    <SheetShell onClose={onClose} onScroll={onScroll} initialDetent="half">
      <Box sx={{ px: 1.5, pb: 4 }}>
        <Typography variant="h6" sx={{ px: 0.5, pt: 0.5, pb: 1.5, fontWeight: 700 }}>
          Stats
        </Typography>

        {/* 1 — Funnel (cumulative reached; Lost separate) */}
        <Section title="Funnel">
          {f.knocked === 0 ? (
            <NotEnough>No prospects worked yet — knock some doors to start the funnel.</NotEnough>
          ) : (
            <>
              <Bar label="Knocked" count={f.knocked} max={funnelMax} color={STAGE_COLORS.knocked} />
              <Bar label="Talked" count={f.talked} max={funnelMax} color={STAGE_COLORS.talked} />
              <Bar label="Quoted" count={f.quoted} max={funnelMax} color={STAGE_COLORS.quoted} />
              <Bar label="Won" count={f.won} max={funnelMax} color={STAGE_COLORS.client} />
              <Divider sx={{ my: 1.25, borderColor: 'rgba(255,255,255,0.08)' }} />
              <Bar label="Lost" count={f.lost} max={funnelMax} color={STAGE_COLORS.lost} />
            </>
          )}
        </Section>

        {/* 2 — Weekly activity (the leading indicator) */}
        <Section title="This week vs last">
          {!anyWeekly ? (
            <NotEnough>No stage changes logged this week or last yet.</NotEnough>
          ) : (
            weeks.map((w) => (
              <Stack
                key={w.stage}
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', py: 0.6 }}
              >
                <Typography sx={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
                  {w.label}
                </Typography>
                <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1.25 }}>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, ...tnum }}>
                    {w.thisWeek}
                  </Typography>
                  <Typography
                    sx={{ fontSize: '0.76rem', color: 'text.secondary', minWidth: 52, textAlign: 'right' }}
                  >
                    last {w.lastWeek}
                  </Typography>
                  <Delta delta={w.delta} />
                </Stack>
              </Stack>
            ))
          )}
        </Section>

        {/* 3 — Conversion rates (gated at 20) */}
        <Section title="Conversion">
          {conv.map((c) => (
            <Stack
              key={c.label}
              direction="row"
              sx={{ alignItems: 'center', justifyContent: 'space-between', py: 0.7, gap: 1 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.92rem', fontWeight: 600 }}>{c.label}</Typography>
                {c.ready && (
                  <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                    {c.child} of {c.parent}
                  </Typography>
                )}
              </Box>
              {c.ready ? (
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: 'primary.main', ...tnum }}>
                  {Math.round((c.rate ?? 0) * 100)}%
                </Typography>
              ) : (
                <Typography
                  sx={{ fontSize: '0.78rem', color: 'text.secondary', textAlign: 'right', maxWidth: 150 }}
                >
                  need {c.need} more to read reliably
                </Typography>
              )}
            </Stack>
          ))}
        </Section>

        {/* 4 — By neighborhood (sorted by Won desc) */}
        <Section title="By neighborhood">
          {nbs.length === 0 ? (
            <NotEnough>No quotes yet — once you quote, your best ground shows here.</NotEnough>
          ) : (
            <>
              <Stack
                direction="row"
                sx={{
                  pb: 0.5,
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                <Box sx={{ flex: 1 }}>District</Box>
                <Box sx={{ width: 64, textAlign: 'right' }}>Quoted</Box>
                <Box sx={{ width: 52, textAlign: 'right' }}>Won</Box>
              </Stack>
              {nbs.map((n) => (
                <Stack
                  key={n.neighborhood}
                  direction="row"
                  sx={{ py: 0.6, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Typography sx={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, minWidth: 0 }} noWrap>
                    {n.neighborhood}
                  </Typography>
                  <Typography
                    sx={{ width: 64, textAlign: 'right', fontSize: '0.92rem', fontWeight: 700, color: STAGE_COLORS.quoted, ...tnum }}
                  >
                    {n.quoted}
                  </Typography>
                  <Typography
                    sx={{ width: 52, textAlign: 'right', fontSize: '0.92rem', fontWeight: 700, color: STAGE_COLORS.client, ...tnum }}
                  >
                    {n.won}
                  </Typography>
                </Stack>
              ))}
            </>
          )}
        </Section>

        {/* 5 — Lost reasons (gated at 10) */}
        <Section title="Lost reasons">
          {!lr.ready ? (
            <NotEnough>
              Not enough data yet ({lr.total}/{LOST_GATE} losses).
            </NotEnough>
          ) : (
            lr.rows.map((r) => (
              <Bar
                key={r.reason}
                label={LOST_REASON_LABELS[r.reason]}
                count={r.count}
                max={lrMax}
                color={STAGE_COLORS.lost}
              />
            ))
          )}
        </Section>
      </Box>
    </SheetShell>
  );
}
