import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Daily Web Push digest (Vercel Cron, see vercel.json): counts follow-ups due
// today/overdue and pushes "N follow-ups due today" to every stored
// subscription. Excluded from the password gate (proxy.ts); authenticates cron
// callers via CRON_SECRET. No-op (clear 500) until the VAPID env is set.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:radar@tydal.tech';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicKey || !privateKey || !url || !key) {
    return NextResponse.json(
      { ok: false, error: 'Push not configured (VAPID / Supabase env missing).' },
      { status: 500 },
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const today = new Date().toISOString().slice(0, 10);
  const { count: due, error: e1 } = await supabase
    .from('pipeline')
    .select('*', { count: 'exact', head: true })
    .not('follow_up_date', 'is', null)
    .lte('follow_up_date', today);
  if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });
  if (!due) return NextResponse.json({ ok: true, due: 0, sent: 0 });

  const { data: subs, error: e2 } = await supabase.from('push_subscriptions').select('*');
  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });

  const payload = JSON.stringify({
    title: 'Tydal Radar',
    body: `${due} follow-up${due === 1 ? '' : 's'} due today.`,
  });

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(s.endpoint); // gone → prune
      }
    }),
  );
  if (stale.length) await supabase.from('push_subscriptions').delete().in('endpoint', stale);

  return NextResponse.json({ ok: true, due, sent, pruned: stale.length });
}
