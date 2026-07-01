'use client';

import type { ReactNode } from 'react';
import { Box, Chip, Stack, Typography, Button } from '@mui/material';
import { NEIGHBORHOODS, ICP, ICP_TYPES } from '@/lib/icp';
import { STAGES, STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR, type Stage } from '@/lib/stages';
import { isUrgent } from '@/lib/contracts';
import type { IcpType, ProspectView } from '@/lib/types';
import { type Filters, EMPTY_FILTERS, anyActiveFilter } from '@/lib/filters';

const NB_SHORT: Record<string, string> = {
  'Ville-Marie': 'Ville-Marie',
  'Shaughnessy Village': 'Shaughnessy',
  'Plateau-Mont-Royal': 'Plateau',
  'Côte-des-Neiges–NDG': 'CDN–NDG',
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        mt: 2,
        mb: 1,
        fontSize: '0.78rem',
        fontWeight: 700,
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

// The relocated filter UI (was the top chip row): neighborhood / type / stage,
// each with faceted counts that respect the other active filters. Rendered inside
// the dark Popover opened by the map's filter button. Same toggle logic as
// before — just moved off the map's top edge.
export default function FilterPanel({
  views,
  filters,
  setFilters,
}: {
  views: ProspectView[];
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const { nb, types, stage, attention } = filters;
  const typeMatch = (t: IcpType) => types.length === 0 || types.includes(t);

  const countNb = (name: string) =>
    views.filter(
      (v) =>
        typeMatch(v.type) &&
        (stage === 'all' || v.stage === stage) &&
        v.neighborhood === name,
    ).length;
  const countType = (t: IcpType) =>
    views.filter(
      (v) =>
        (nb === 'all' || v.neighborhood === nb) &&
        (stage === 'all' || v.stage === stage) &&
        v.type === t,
    ).length;
  const countStage = (s: Stage) =>
    views.filter(
      (v) =>
        (nb === 'all' || v.neighborhood === nb) &&
        typeMatch(v.type) &&
        v.stage === s,
    ).length;

  const anyActive = anyActiveFilter(filters);
  const urgentCount = views.filter(isUrgent).length;

  return (
    <Box sx={{ width: 290, maxWidth: '88vw', maxHeight: '62vh', overflowY: 'auto', p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Filters</Typography>
        {anyActive && (
          <Button
            size="small"
            onClick={() => setFilters(EMPTY_FILTERS)}
            sx={{ color: 'text.secondary', minWidth: 0 }}
          >
            Clear all
          </Button>
        )}
      </Stack>

      {/* One-tap urgency filter: due/overdue follow-ups + soon-expiring contracts. */}
      <Box sx={{ mt: 1.5 }}>
        <Chip
          key={`attention-${attention}`}
          className={attention ? 'tydal-pop' : undefined}
          label={`Needs attention ${urgentCount}`}
          variant={attention ? 'filled' : 'outlined'}
          onClick={() => setFilters({ ...filters, attention: !attention })}
          sx={{
            fontWeight: 600,
            bgcolor: attention ? '#d93025' : 'transparent',
            color: attention ? '#fff' : 'text.primary',
            borderColor: '#d93025',
          }}
        />
      </Box>

      <SectionLabel>Neighborhood</SectionLabel>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {NEIGHBORHOODS.map(({ name }) => {
          const selected = nb === name;
          return (
            <Chip
              key={`${name}-${selected}`}
              className={selected ? 'tydal-pop' : undefined}
              label={`${NB_SHORT[name] ?? name} ${countNb(name)}`}
              variant={selected ? 'filled' : 'outlined'}
              onClick={() => setFilters({ ...filters, nb: selected ? 'all' : name })}
              sx={{
                bgcolor: selected ? '#FFFFFF' : 'transparent',
                color: selected ? '#000000' : 'text.primary',
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            />
          );
        })}
      </Box>

      <SectionLabel>Type</SectionLabel>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {ICP_TYPES.map((t) => {
          const selected = types.includes(t);
          return (
            <Chip
              key={`${t}-${selected}`}
              className={selected ? 'tydal-pop' : undefined}
              label={`${ICP[t].label} ${countType(t)}`}
              variant={selected ? 'filled' : 'outlined'}
              onClick={() =>
                setFilters({
                  ...filters,
                  types: selected ? types.filter((x) => x !== t) : [...types, t],
                })
              }
              sx={{
                bgcolor: selected ? '#FFFFFF' : 'transparent',
                color: selected ? '#000000' : 'text.primary',
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            />
          );
        })}
      </Box>

      <SectionLabel>Stage</SectionLabel>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {STAGES.map((s) => {
          const selected = stage === s;
          return (
            <Chip
              key={`${s}-${selected}`}
              className={selected ? 'tydal-pop' : undefined}
              label={`${STAGE_LABELS[s]} ${countStage(s)}`}
              variant={selected ? 'filled' : 'outlined'}
              onClick={() => setFilters({ ...filters, stage: selected ? 'all' : s })}
              sx={{
                fontWeight: 600,
                bgcolor: selected ? STAGE_COLORS[s] : 'transparent',
                color: selected ? STAGE_ON_COLOR[s] : 'text.primary',
                borderColor: STAGE_COLORS[s],
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
