// Shared-password gate helpers. The cookie stores a SHA-256 hash of the
// password (never the password itself, never reversible). Middleware and the
// login route both derive the expected hash from the server-only APP_PASSWORD,
// so the cookie can't be forged without knowing the password.
//
// Uses the Web Crypto API (global in both the Node and Edge runtimes), so the
// same code runs in middleware and route handlers.

export const AUTH_COOKIE = 'tr_auth';
export const AUTH_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** The cookie value a logged-in client should hold, or null if unconfigured. */
export async function expectedToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return sha256Hex(`tydal-radar::${pw}`);
}
