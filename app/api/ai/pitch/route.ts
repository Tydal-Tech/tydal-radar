import { NextResponse } from 'next/server';
import type { PitchSignals, AiPitch } from '@/lib/aiPitch';
import { runAgent, BudgetError } from '@/lib/runAgent';
import { draftPitch, UpstreamError } from '@/lib/pitchAgent';

// Server-only so the Anthropic key never reaches the client bundle. This route
// is gated by the app password (proxy.ts) — only the authenticated app calls it,
// which also stops anyone from burning the key. Set ANTHROPIC_API_KEY (and
// optionally ANTHROPIC_MODEL) in the environment. Runs through runAgent so every
// pitch is budgeted + logged (Phase 0). The Claude call itself lives in
// lib/pitchAgent (shared with the batch pre-draft route).
export const runtime = 'nodejs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'AI is not configured (set ANTHROPIC_API_KEY)' }, { status: 503 });
  }

  let signals: PitchSignals;
  try {
    signals = (await req.json()) as PitchSignals;
    if (!signals?.name) throw new Error('missing prospect');
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const { result } = await runAgent<AiPitch>({
      role: 'pitch-writer',
      department: 'revenue',
      model: MODEL,
      run: () => draftPitch(signals, { key, model: MODEL }),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BudgetError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    if (e instanceof UpstreamError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
  }
}
