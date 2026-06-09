'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
} from '@mui/material';
import RadarIcon from '@mui/icons-material/Radar';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Full reload so middleware re-evaluates with the new cookie.
        window.location.href = '/';
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Login failed.');
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        height: '100dvh',
        width: '100vw',
        bgcolor: '#1a1f36',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Paper
        elevation={6}
        sx={{ p: 4, width: '100%', maxWidth: 360, borderRadius: 4 }}
      >
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <RadarIcon sx={{ color: 'secondary.main', fontSize: 36 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1f36' }}>
              Tydal Radar
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Enter the shared password to continue.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || !password}
          >
            {loading ? 'Checking…' : 'Unlock'}
          </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
