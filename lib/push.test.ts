import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array, subscriptionToRow } from './push';

describe('urlBase64ToUint8Array', () => {
  it('decodes an unpadded base64url string to bytes', () => {
    // base64url("hello") = "aGVsbG8"
    expect([...urlBase64ToUint8Array('aGVsbG8')]).toEqual([104, 101, 108, 108, 111]);
  });

  it('handles the url-safe alphabet (- and _)', () => {
    // "-_" (base64url) === "+/" (base64) → bytes [251, 255]
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });

  it('produces the standard 65-byte length for a real VAPID public key shape', () => {
    // A 65-byte P-256 public key encodes to 87 base64url chars (unpadded).
    const key = 'B'.repeat(87);
    expect(urlBase64ToUint8Array(key)).toHaveLength(65);
  });
});

describe('subscriptionToRow', () => {
  it('flattens endpoint + keys', () => {
    expect(
      subscriptionToRow({
        endpoint: 'https://push.example/abc',
        keys: { p256dh: 'PKEY', auth: 'AKEY' },
      }),
    ).toEqual({ endpoint: 'https://push.example/abc', p256dh: 'PKEY', auth: 'AKEY' });
  });

  it('returns null when keys or endpoint are missing', () => {
    expect(subscriptionToRow({ endpoint: 'https://x' })).toBeNull();
    expect(subscriptionToRow({ keys: { p256dh: 'a', auth: 'b' } })).toBeNull();
    expect(subscriptionToRow({ endpoint: 'https://x', keys: { p256dh: 'a' } })).toBeNull();
  });
});
