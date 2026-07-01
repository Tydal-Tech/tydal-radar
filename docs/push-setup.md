# Follow-up push notifications — setup

The code ships dormant. Until these steps are done, the "Remind me" toggle stays
hidden and `/api/notify-followups` returns a clear 500. Do these once:

## 1. Generate a VAPID keypair
```bash
npx web-push generate-vapid-keys
```
Copy the **Public** and **Private** keys it prints.

## 2. Set env vars (both locally and in Vercel → Project → Settings → Environment Variables)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the public key (safe to expose; it's in the client)
- `VAPID_PRIVATE_KEY` = the private key (**secret** — server only)
- `VAPID_SUBJECT` = `mailto:you@example.com` (optional; defaults to a placeholder)
- `CRON_SECRET` = any random string (if not already set — also gates the keep-alive)

Local: add them to `.env.local`.

## 3. Create the subscriptions table
Run the `push_subscriptions` block at the bottom of `SUPABASE.sql` in the
Supabase SQL editor.

## 4. Redeploy
Push any commit (or redeploy in Vercel) so the client build picks up
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## 5. Subscribe on your device
Open the **installed PWA** (iOS 16.4+, Android, or desktop — web push needs the
app installed on iOS) → **Follow-ups** tab → tap **"Remind me"** → allow
notifications.

## 6. How it fires
A Vercel Cron runs `/api/notify-followups` daily at **13:00 UTC** and, if any
follow-ups are due today/overdue, pushes "N follow-ups due today" to every
subscribed device. To test immediately:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/notify-followups
# → { "ok": true, "due": N, "sent": M, "pruned": 0 }
```

Notes: it's a once-daily digest (no per-follow-up spam); expired subscriptions
(HTTP 404/410) are pruned automatically.
