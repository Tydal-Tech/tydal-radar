import { NextResponse } from 'next/server';
import { hasValidSession, serviceClient } from '@/lib/serverDb';
import type { Prospect } from '@/lib/types';

// Insert new prospects (in-app Refresh), ignoring duplicates. Password-gated +
// service-role, so the public anon key can be denied write access to `prospects`.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let rows: Prospect[];
  try {
    rows = (await req.json()) as Prospect[];
    if (!Array.isArray(rows)) throw new Error('expected an array');
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ count: 0 });
  const { error } = await serviceClient()
    .from('prospects')
    .upsert(rows, { onConflict: 'place_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: rows.length });
}
