// Server-side Web Push fan-out (Node runtime). Best-effort by design: a no-op
// when VAPID is unconfigured, and it never throws — callers use it fire-and-
// forget. Reuses the same VAPID keys + push_subscriptions table as the daily
// follow-up digest (app/api/notify-followups/route.ts). Stale endpoints
// (404/410) are pruned, matching that route.

import webpush from 'web-push';
import { serviceClient } from './serverDb';

let vapidReady: boolean | null = null;
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:radar@tydal.tech';
  if (!publicKey || !privateKey) {
    vapidReady = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

/** Push `{title, body}` to every stored subscription. Best-effort; never throws. */
export async function sendPush(title: string, body: string): Promise<void> {
  try {
    if (!ensureVapid()) return;
    const db = serviceClient();
    const { data: subs, error } = await db.from('push_subscriptions').select('*');
    if (error || !subs?.length) return;
    const payload = JSON.stringify({ title, body });
    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) stale.push(s.endpoint); // gone → prune
        }
      }),
    );
    if (stale.length) await db.from('push_subscriptions').delete().in('endpoint', stale);
  } catch {
    // Alerts must never take down a run (AGENTS.md: observability can't break the product).
  }
}
