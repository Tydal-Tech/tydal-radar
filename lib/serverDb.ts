// Server-only data helpers. Writes go through route handlers that use the
// SERVICE-ROLE key (bypasses RLS) and require a valid app-password session — so
// the public anon key can be denied write access entirely. NEVER import this
// from client code: SUPABASE_SERVICE_ROLE_KEY is server-only and would be
// undefined in the browser.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, expectedToken } from './auth';

/** True when the caller holds a valid app-password session (mirrors proxy.ts). */
export async function hasValidSession(): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true; // unconfigured (e.g. local dev) → open, same as the gate
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === expected;
}

/** Service-role Supabase client — server only, bypasses RLS. */
export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials are not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}
