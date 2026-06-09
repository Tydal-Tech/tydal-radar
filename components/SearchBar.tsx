'use client';

import { Paper, InputBase, Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RadarIcon from '@mui/icons-material/Radar';

export default function SearchBar({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (q: string) => void;
}) {
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 'calc(var(--safe-top) + 12px)',
        left: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 999,
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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          color: '#1a1f36',
          fontWeight: 700,
          fontSize: 15,
          pr: 0.5,
        }}
      >
        <RadarIcon sx={{ color: 'secondary.main', fontSize: 22 }} />
        Tydal Radar
      </Box>
    </Paper>
  );
}
