'use client';

import { useEffect, useState } from 'react';
import {
  SwipeableDrawer,
  Box,
  Typography,
  Chip,
  Stack,
  Button,
  TextField,
  Divider,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import DirectionsIcon from '@mui/icons-material/Directions';
import { useData } from './DataProvider';
import { STAGES, STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR, type Stage } from '@/lib/stages';
import { ICP } from '@/lib/icp';
import { openDirections } from '@/lib/directions';
import type { IcpType } from '@/lib/types';

export default function ProspectSheet() {
  const { views, selectedId, setSelectedId, save } = useData();
  const view = views.find((v) => v.place_id === selectedId) ?? null;

  const [stage, setStage] = useState<Stage>('not_knocked');
  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);

  // Load the selected prospect's current state into the editable draft.
  useEffect(() => {
    if (view) {
      setStage(view.stage);
      setNote(view.note ?? '');
      setFollowUp(view.follow_up_date ?? '');
    }
  }, [view]);

  const close = () => setSelectedId(null);

  async function onSave() {
    if (!view) return;
    setSaving(true);
    try {
      await save(view.place_id, {
        stage,
        note: note.trim() ? note.trim() : null,
        follow_up_date: followUp || null,
      });
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={!!view}
      onClose={close}
      onOpen={() => {}}
      disableSwipeToOpen
      slotProps={{ paper: { sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20 } } }}
    >
      {/* grabber */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#dadce0' }} />
      </Box>

      {view && (
        <Box sx={{ p: 2.5, pb: 'calc(var(--safe-bottom) + 20px)', maxHeight: '85vh', overflowY: 'auto' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                {view.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {ICP[view.type as IcpType].label} · {view.neighborhood}
              </Typography>
            </Box>
            <Chip
              label={STAGE_LABELS[view.stage]}
              sx={{
                bgcolor: STAGE_COLORS[view.stage],
                color: STAGE_ON_COLOR[view.stage],
                fontWeight: 600,
                flexShrink: 0,
              }}
            />
          </Stack>

          {view.address && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {view.address}
            </Typography>
          )}

          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PhoneIcon />}
              disabled={!view.phone}
              component="a"
              href={view.phone ? `tel:${view.phone}` : undefined}
            >
              Call
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<DirectionsIcon />}
              onClick={() => openDirections(view.address ?? `${view.lat},${view.lng}`)}
            >
              Directions
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Stage
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {STAGES.map((s) => {
              const selected = s === stage;
              return (
                <Chip
                  key={s}
                  label={STAGE_LABELS[s]}
                  onClick={() => setStage(s)}
                  variant={selected ? 'filled' : 'outlined'}
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

          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            sx={{ mt: 2.5 }}
          />

          <TextField
            label="Follow-up date"
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ mt: 2 }}
          />

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={onSave}
            disabled={saving}
            sx={{ mt: 2.5 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      )}
    </SwipeableDrawer>
  );
}
