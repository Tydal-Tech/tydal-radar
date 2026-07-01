import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { AUTH_COOKIE, AUTH_MAX_AGE, expectedToken } from './auth';

const original = process.env.APP_PASSWORD;
afterEach(() => {
  if (original === undefined) delete process.env.APP_PASSWORD;
  else process.env.APP_PASSWORD = original;
});

describe('auth constants', () => {
  it('uses a stable cookie name and a 180-day max age', () => {
    expect(AUTH_COOKIE).toBe('tr_auth');
    expect(AUTH_MAX_AGE).toBe(60 * 60 * 24 * 180);
  });
});

describe('expectedToken', () => {
  it('is null when APP_PASSWORD is unset (gate open)', async () => {
    delete process.env.APP_PASSWORD;
    expect(await expectedToken()).toBeNull();
  });

  it('treats an empty password as unconfigured', async () => {
    process.env.APP_PASSWORD = '';
    expect(await expectedToken()).toBeNull();
  });

  it('is a salted SHA-256 hex of the password (matches an independent digest)', async () => {
    process.env.APP_PASSWORD = 'hunter2';
    const tok = await expectedToken();
    expect(tok).toMatch(/^[0-9a-f]{64}$/);
    const independent = createHash('sha256').update('tydal-radar::hunter2').digest('hex');
    expect(tok).toBe(independent);
  });

  it('is deterministic and password-specific', async () => {
    process.env.APP_PASSWORD = 'abc';
    const a1 = await expectedToken();
    const a2 = await expectedToken();
    process.env.APP_PASSWORD = 'xyz';
    const b = await expectedToken();
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  it('never returns the raw password', async () => {
    process.env.APP_PASSWORD = 'sup3r-secret';
    expect(await expectedToken()).not.toContain('sup3r-secret');
  });
});
