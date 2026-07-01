'use client';

import { useEffect, useState } from 'react';
import { Chip } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { urlBase64ToUint8Array, subscriptionToRow } from '@/lib/push';
import { savePushSubscription, deletePushSubscription } from '@/lib/db';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

// Enable/disable Web Push follow-up reminders. Hidden entirely until push is
// supported AND a VAPID public key is configured, so it's a no-op before setup.
export default function NotifyToggle() {
  const [subscribed, setSubscribed] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported() || !VAPID_PUBLIC) return;
    let alive = true;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (alive) {
          setSubscribed(!!sub);
          setReady(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!supported() || !VAPID_PUBLIC || !ready) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await deletePushSubscription(existing.endpoint);
        await existing.unsubscribe();
        setSubscribed(false);
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });
        const row = subscriptionToRow(sub.toJSON());
        if (row) await savePushSubscription(row);
        setSubscribed(true);
      }
    } catch {
      // permission denied / offline — leave the state as it was
    } finally {
      setBusy(false);
    }
  };

  return (
    <Chip
      icon={
        subscribed ? (
          <NotificationsActiveIcon sx={{ fontSize: 18 }} />
        ) : (
          <NotificationsNoneIcon sx={{ fontSize: 18 }} />
        )
      }
      label={subscribed ? 'Reminders on' : 'Remind me'}
      variant={subscribed ? 'filled' : 'outlined'}
      onClick={toggle}
      disabled={busy}
      sx={{
        fontWeight: 600,
        bgcolor: subscribed ? '#1a73e8' : 'transparent',
        color: subscribed ? '#fff' : 'text.primary',
        borderColor: '#1a73e8',
      }}
    />
  );
}
