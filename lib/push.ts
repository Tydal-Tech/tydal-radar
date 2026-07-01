// Web Push helpers (client side): turn the base64url VAPID public key into the
// applicationServerKey bytes PushManager.subscribe wants, and serialize a
// PushSubscription into the row we persist in Supabase.

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  // Backed by a plain ArrayBuffer so it satisfies BufferSource (applicationServerKey).
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export interface PushRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Flatten a PushSubscription's JSON into our storage row, or null if malformed. */
export function subscriptionToRow(sub: PushSubscriptionJSON): PushRow | null {
  const { endpoint, keys } = sub;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return null;
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}
