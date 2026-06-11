'use client';

import { Paper, InputBase } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { glassSx } from '@/lib/glass';

export default function SearchBar({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (q: string) => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        // Bottom-anchored, floating just above the nav for thumb reach.
        position: 'absolute',
        bottom: 'calc(var(--safe-bottom) + 84px)',
        left: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 999,
        ...glassSx,
      }}
    >
      <SearchIcon sx={{ color: 'text.secondary' }} />
      <InputBase
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Search Tydal Radar"
        sx={{ flex: 1, fontSize: 16 }}
        inputProps={{ 'aria-label': 'Search prospects' }}
      />
    </Paper>
  );
}
