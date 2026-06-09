'use client';

import { Box, Chip, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { NEIGHBORHOODS, ICP, ICP_TYPES } from '@/lib/icp';
import { STAGES, STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR, type Stage } from '@/lib/stages';
import type { IcpType, ProspectView } from '@/lib/types';

const NB_SHORT: Record<string, string> = {
  'Ville-Marie': 'Ville-Marie',
  'Shaughnessy Village': 'Shaughnessy',
  'Plateau-Mont-Royal': 'Plateau',
  'Côte-des-Neiges–NDG': 'CDN–NDG',
};

export interface Filters {
  nb: string | 'all';
  type: IcpType | 'all';
  stage: Stage | 'all';
}

export default function FilterChips({
  views,
  query,
  filters,
  setFilters,
}: {
  views: ProspectView[];
  query: string;
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const { nb, type, stage } = filters;
  const q = query.trim().toLowerCase();
  const matchSearch = (v: ProspectView) =>
    !q || v.name.toLowerCase().includes(q) || (v.address ?? '').toLowerCase().includes(q);

  // Faceted counts: each dimension's counts respect the OTHER active filters.
  const countNb = (name: string) =>
    views.filter(
      (v) =>
        matchSearch(v) &&
        (type === 'all' || v.type === type) &&
        (stage === 'all' || v.stage === stage) &&
        v.neighborhood === name,
    ).length;
  const countType = (t: IcpType) =>
    views.filter(
      (v) =>
        matchSearch(v) &&
        (nb === 'all' || v.neighborhood === nb) &&
        (stage === 'all' || v.stage === stage) &&
        v.type === t,
    ).length;
  const countStage = (s: Stage) =>
    views.filter(
      (v) =>
        matchSearch(v) &&
        (nb === 'all' || v.neighborhood === nb) &&
        (type === 'all' || v.type === type) &&
        v.stage === s,
    ).length;

  const anyActive = nb !== 'all' || type !== 'all' || stage !== 'all';
  const sep = (
    <Box sx={{ alignSelf: 'center', width: '1px', height: 22, bgcolor: '#cfd4da', mx: 0.5, flexShrink: 0 }} />
  );

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        position: 'absolute',
        top: 'calc(var(--safe-top) + 70px)',
        left: 0,
        right: 0,
        px: 1.5,
        zIndex: 1000,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        pb: 0.5,
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {anyActive && (
        <Chip
          icon={<CloseIcon />}
          label="Clear"
          color="default"
          onClick={() => setFilters({ nb: 'all', type: 'all', stage: 'all' })}
          sx={{ bgcolor: 'background.paper', flexShrink: 0, fontWeight: 600 }}
        />
      )}

      {NEIGHBORHOODS.map(({ name }) => {
        const selected = nb === name;
        return (
          <Chip
            key={name}
            label={`${NB_SHORT[name] ?? name} ${countNb(name)}`}
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, nb: selected ? 'all' : name })}
            sx={{ bgcolor: selected ? undefined : 'background.paper', flexShrink: 0 }}
          />
        );
      })}

      {sep}

      {ICP_TYPES.map((t) => {
        const selected = type === t;
        return (
          <Chip
            key={t}
            label={`${ICP[t].label} ${countType(t)}`}
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, type: selected ? 'all' : t })}
            sx={{ bgcolor: selected ? undefined : 'background.paper', flexShrink: 0 }}
          />
        );
      })}

      {sep}

      {STAGES.map((s) => {
        const selected = stage === s;
        return (
          <Chip
            key={s}
            label={`${STAGE_LABELS[s]} ${countStage(s)}`}
            variant={selected ? 'filled' : 'outlined'}
            onClick={() => setFilters({ ...filters, stage: selected ? 'all' : s })}
            sx={{
              flexShrink: 0,
              fontWeight: 600,
              bgcolor: selected ? STAGE_COLORS[s] : 'background.paper',
              color: selected ? STAGE_ON_COLOR[s] : 'text.primary',
              borderColor: STAGE_COLORS[s],
            }}
          />
        );
      })}
    </Stack>
  );
}
