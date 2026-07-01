import { NextResponse } from 'next/server';
import { hasValidSession, serviceClient, fetchAll } from '@/lib/serverDb';
import type { Pipeline } from '@/lib/types';

// Read + write `pipeline`. Password-gated + service-role, so the public anon key
// can be denied all access to `pipeline`.
export const runtime = 'nodejs';

export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await fetchAll<Pipeline>('pipeline'));
  } catch {
    return NextResponse.json({ error: 'failed to load pipeline' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let row: Pipeline;
  try {
    row = (await req.json()) as Pipeline;
    if (!row?.place_id) throw new Error('missing place_id');
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const { error } = await serviceClient()
    .from('pipeline')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'place_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
