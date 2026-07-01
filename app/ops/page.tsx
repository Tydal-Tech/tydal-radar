'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Stack,
  Paper,
  Typography,
  LinearProgress,
  IconButton,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';

// The CEO cockpit (Phase 0 — see docs/phase-0-observability.md). A gated,
// read-only view over /api/ops/summary: spend vs budget, agents running now,
// recent runs, the error feed, and top spenders. Reads only — no controls
// spend money. (The approvals queue is Phase 1; a slot is left for it.)

interface BudgetLine {
  scope: string;
  period: string;
  spent: number;
  limit: number;
  pct: number;
}
interface Run {
  id: string;
  role: string;
  department: string;
  model: string;
  status: string;
  cost_usd: number;
  duration_ms: number | null;
  created_at: string;
}
interface ErrorRow {
  id: string;
  role: string;
  model: string;
  error: string | null;
  created_at: string;
}
interface Summary {
  spend: { global: { day: number; week: number; month: number } };
  budgets: BudgetLine[];
  byDepartment: { department: string; month: number }[];
  byRole: { role: string; month: number }[];
  running: Run[];
  recent: Run[];
  errors: ErrorRow[];
  configured: boolean;
}

// Costs run from sub-cent (one pitch ≈ 1.7¢) to tens of dollars (monthly),
// so show more precision the smaller the number is.
function money(n: number): string {
  const v = Number(n) || 0;
  if (v === 0) return '$0.00';
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

function duration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

function barColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 100) return 'error';
  if (pct >= 80) return 'warning';
  return 'success';
}

function statusColor(status: string): string {
  if (status === 'success') return '#22c55e';
  if (status === 'error') return '#ef4444';
  if (status === 'blocked') return '#f59e0b';
  return '#06b6d4'; // running
}

const CARD_SX = { p: 2, borderRadius: 3, bgcolor: 'background.paper' } as const;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper sx={CARD_SX}>
      <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
        {title}
      </Typography>
      <Box sx={{ mt: 1 }}>{children}</Box>
    </Paper>
  );
}

export default function OpsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/ops/summary', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Summary);
    } catch {
      setError('Could not load the cockpit.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Keep "Live" honest without hammering the DB.
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const spend = data?.spend.global;

  return (
    <Box
      sx={{
        height: 'var(--app-height, 100dvh)',
        overflowY: 'auto',
        bgcolor: 'background.default',
        pt: 'calc(var(--safe-top, 0px) + 12px)',
        pb: 'calc(var(--safe-bottom, 0px) + 32px)',
        px: 2,
      }}
    >
      <Stack spacing={2} sx={{ maxWidth: 640, mx: 'auto' }}>
        {/* Header */}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <IconButton aria-label="Back" href="/" sx={{ ml: -1 }}>
            <ArrowBackIcon />
          </IconButton>
          <PriceCheckIcon sx={{ color: 'secondary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
            Ops · Spend
          </Typography>
          <IconButton aria-label="Refresh" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Stack>

        {error && (
          <Paper sx={{ ...CARD_SX, borderLeft: '3px solid #ef4444' }}>
            <Typography variant="body2">{error}</Typography>
          </Paper>
        )}

        {loading && !data && (
          <Stack sx={{ alignItems: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Stack>
        )}

        {data && !data.configured && (
          <Paper sx={CARD_SX}>
            <Typography variant="body2" color="text.secondary">
              No runs yet. Either nothing has gone through <code>runAgent()</code> or the{' '}
              <code>agent_runs</code> / <code>agent_budgets</code> tables aren&apos;t migrated. Trigger
              a pitch, or run the Phase&nbsp;0 migration, then refresh.
            </Typography>
          </Paper>
        )}

        {data && data.configured && (
          <>
            {/* Spend at a glance */}
            <Stack direction="row" spacing={1.5}>
              {(['day', 'week', 'month'] as const).map((k) => (
                <Paper key={k} sx={{ ...CARD_SX, flex: 1, textAlign: 'center' }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    {k === 'day' ? 'Today' : k === 'week' ? 'This wk' : 'This mo'}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {money(spend?.[k] ?? 0)}
                  </Typography>
                </Paper>
              ))}
            </Stack>

            {/* Budget bars */}
            <SectionCard title="Budgets">
              {data.budgets.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No caps set. Seed <code>agent_budgets</code> to enforce spend limits.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {data.budgets.map((b) => (
                    <Box key={`${b.scope}|${b.period}`}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {b.scope} · {b.period}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {money(b.spent)} / {money(b.limit)} · {Math.round(b.pct)}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, b.pct)}
                        color={barColor(b.pct)}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  ))}
                </Stack>
              )}
            </SectionCard>

            {/* Live */}
            <SectionCard title={`Running now (${data.running.length})`}>
              {data.running.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No agents running.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {data.running.map((r) => (
                    <Stack key={r.id} direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={14} sx={{ color: 'secondary.main' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                        {r.role}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.model} · {ago(r.created_at)} ago
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>

            {/* Top spenders */}
            {(data.byDepartment.length > 0 || data.byRole.length > 0) && (
              <SectionCard title="Top spenders · month">
                <Stack spacing={1.5}>
                  {data.byDepartment.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        By department
                      </Typography>
                      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                        {data.byDepartment.map((d) => (
                          <Chip
                            key={d.department}
                            size="small"
                            label={`${d.department} · ${money(d.month)}`}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {data.byRole.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        By role
                      </Typography>
                      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                        {data.byRole.map((r) => (
                          <Chip key={r.role} size="small" label={`${r.role} · ${money(r.month)}`} />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </SectionCard>
            )}

            {/* Recent runs */}
            <SectionCard title="Recent runs">
              {data.recent.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing logged yet.
                </Typography>
              ) : (
                <Stack divider={<Divider flexItem sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}>
                  {data.recent.map((r) => (
                    <Stack
                      key={r.id}
                      direction="row"
                      sx={{ alignItems: 'center', gap: 1, py: 0.75 }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: statusColor(r.status),
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {r.role}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {r.model} · {duration(r.duration_ms)} · {ago(r.created_at)} ago
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {money(r.cost_usd)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>

            {/* Errors */}
            {data.errors.length > 0 && (
              <SectionCard title={`Errors (${data.errors.length})`}>
                <Stack spacing={1}>
                  {data.errors.map((e) => (
                    <Box key={e.id}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444' }}>
                          {e.role}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ago(e.created_at)} ago
                        </Typography>
                      </Stack>
                      {e.error && (
                        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                          {e.error}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </SectionCard>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}
