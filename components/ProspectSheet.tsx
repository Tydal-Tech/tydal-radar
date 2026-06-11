'use client';

import { useEffect, useState } from 'react';
import {
  SwipeableDrawer,
  Box,
  Typography,
  Chip,
  Stack,
  Button,
  IconButton,
  TextField,
  Divider,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import DirectionsIcon from '@mui/icons-material/Directions';
import ClearIcon from '@mui/icons-material/Clear';
import { useData } from './DataProvider';
import { STAGES, STAGE_COLORS, STAGE_LABELS, STAGE_ON_COLOR, type Stage } from '@/lib/stages';
import { ICP } from '@/lib/icp';
import { parseExpiry } from '@/lib/contracts';
import { openDirections } from '@/lib/directions';
import type { IcpType } from '@/lib/types';

export default function ProspectSheet() {
  const { views, selectedId, setSelectedId, save } = useData();
  const view = views.find((v) => v.place_id === selectedId) ?? null;

  const [stage, setStage] = useState<Stage>('not_knocked');
  const [note, setNote] = useState('');
  const [contactName, setContactName] = useState('');
  const [currentProvider, setCurrentProvider] = useState('');
  const [contractExpiry, setContractExpiry] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Load the selected prospect's current state into the editable draft.
  useEffect(() => {
    if (view) {
      setStage(view.stage);
      setNote(view.note ?? '');
      setContactName(view.contact_name ?? '');
      setCurrentProvider(view.current_provider ?? '');
      setContractExpiry(parseExpiry(view.contract_expiry) ?? '');
      setFollowUp(view.follow_up_date ?? '');
      setConfirmClear(false);
    }
  }, [view]);

  // Auto-cancel the "Clear all" confirm so a stray earlier tap can't wipe data later.
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const close = () => setSelectedId(null);

  // Reset the editable draft to a blank prospect. Persisted only when the user taps Save.
  function clearAll() {
    setStage('not_knocked');
    setNote('');
    setContactName('');
    setCurrentProvider('');
    setContractExpiry('');
    setFollowUp('');
    setConfirmClear(false);
  }

  async function onSave() {
    if (!view) return;
    setSaving(true);
    try {
      await save(view.place_id, {
        stage,
        note: note.trim() ? note.trim() : null,
        contact_name: contactName.trim() ? contactName.trim() : null,
        current_provider: currentProvider.trim() ? currentProvider.trim() : null,
        contract_expiry: contractExpiry.trim() ? contractExpiry.trim() : null,
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
      transitionDuration={{ enter: 260, exit: 220 }}
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            bgcolor: 'rgba(28,33,52,0.72)',
            borderTop: '1px solid rgba(255,255,255,0.14)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 -10px 34px rgba(0,0,0,0.40)',
          },
        },
      }}
    >
      {/* grabber */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#dadce0' }} />
      </Box>

      {view && (
        <Box sx={{ p: 2.5, pb: 'calc(var(--safe-bottom) + 20px)', maxHeight: '85vh', overflowY: 'auto' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2 }}>
                {view.name}
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: '1rem', color: 'text.secondary' }}>
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
            <Typography sx={{ mt: 1, fontSize: '1rem', color: 'text.secondary' }}>
              {view.address}
            </Typography>
          )}

          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              size="large"
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
              size="large"
              fullWidth
              startIcon={<DirectionsIcon />}
              onClick={() => openDirections(view.address ?? `${view.lat},${view.lng}`)}
            >
              Directions
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <TextField
            label="Contact name"
            placeholder="e.g. Marie (director)"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            fullWidth
            sx={{ mt: 2.5 }}
          />

          <Typography sx={{ mt: 2.5, mb: 1, fontSize: '1rem', fontWeight: 600 }}>
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
            label="Current provider"
            placeholder="e.g. CleanPro, Jani-King, unknown"
            value={currentProvider}
            onChange={(e) => setCurrentProvider(e.target.value)}
            fullWidth
            sx={{ mt: 2.5 }}
          />

          <TextField
            label="Contract expiry"
            type="month"
            value={contractExpiry}
            onChange={(e) => setContractExpiry(e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ mt: 2.5 }}
          />

          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            sx={{ mt: 2.5 }}
          />

          <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center' }}>
            <TextField
              label="Follow-up date"
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {followUp && (
              <IconButton aria-label="Clear follow-up date" onClick={() => setFollowUp('')}>
                <ClearIcon />
              </IconButton>
            )}
          </Stack>

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

          <Button
            variant="text"
            size="small"
            fullWidth
            disableRipple
            onClick={() => (confirmClear ? clearAll() : setConfirmClear(true))}
            sx={{
              mt: 1,
              fontWeight: 400,
              color: confirmClear ? 'error.main' : 'text.secondary',
            }}
          >
            {confirmClear ? 'Tap again to clear all' : 'Clear all'}
          </Button>
        </Box>
      )}
    </SwipeableDrawer>
  );
}
