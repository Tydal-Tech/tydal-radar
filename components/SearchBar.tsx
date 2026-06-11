'use client';

import { useRef } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    // The whole bar is the tap target: tapping anywhere focuses the field, with
    // a subtle pressed-scale (transform only) for native-feeling feedback.
    <Paper
      elevation={0}
      onClick={() => inputRef.current?.focus()}
      sx={{
        // Bottom-anchored, floating just above the nav for thumb reach.
        position: 'absolute',
        bottom: 'calc(var(--ui-bottom) + 68px)',
        left: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 999,
        cursor: 'text',
        transition: 'transform 150ms cubic-bezier(0.2, 0, 0.2, 1)',
        '&:active': { transform: 'scale(0.985)' },
        ...glassSx,
      }}
    >
      <SearchIcon sx={{ color: 'text.secondary' }} />
      <InputBase
        inputRef={inputRef}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Search Tydal Radar"
        sx={{ flex: 1, fontSize: 16 }}
        inputProps={{ 'aria-label': 'Search prospects' }}
      />
    </Paper>
  );
}
