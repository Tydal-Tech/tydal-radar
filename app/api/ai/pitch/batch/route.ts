import { NextResponse } from 'next/server';
import type { PitchSignals, AiPitch } from '@/lib/aiPitch';
import { runAgent, BudgetError } from '@/lib/runAgent';
import { draftPitch, UpstreamError } from '@/lib/pitchAgent';

// Pitch Writer, batch pre-draft (Phase 1). Given the day's route (from "Plan my
// walk"), draft + return a pitch per stop so the rep opens each door with it
// ready. Each pitch goes through runAgent — budgeted + logged like the single
// route — and the whole batch stops the moment a budget cap is hit. Capped and
// sequential so it can't fan out into a runaway spend or a timeout. App-password
// gated (proxy.ts); key stays server-side.
export const runtime = 'nodejs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_ITEMS = 12;

interface Item {
  placeId: string;
  signals: PitchSignals;
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'AI is not configured (set ANTHROPIC_API_KEY)' }, { status: 503 });
  }

  let items: Item[];
  try {
    const body = (await req.json()) as { items?: Item[] };
    items = (body.items ?? []).filter((i) => i?.placeId && i?.signals?.name).slice(0, MAX_ITEMS);
    if (items.length === 0) throw new Error('no items');
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const results: { placeId: string; pitch: AiPitch }[] = [];
  const errors: { placeId: string; error: string }[] = [];
  let stopped: 'budget' | null = null;

  // Sequential + early budget stop: predictable spend, no races, no timeout blowout.
  for (const item of items) {
    try {
      const { result } = await runAgent<AiPitch>({
        role: 'pitch-writer',
        department: 'revenue',
        model: MODEL,
        run: () => draftPitch(item.signals, { key, model: MODEL }),
      });
      results.push({ placeId: item.placeId, pitch: result });
    } catch (e) {
      if (e instanceof BudgetError) {
        stopped = 'budget';
        break; // tapped out — stop the batch, return what we have
      }
      errors.push({
        placeId: item.placeId,
        error: e instanceof UpstreamError ? e.message : 'AI request failed',
      });
    }
  }

  return NextResponse.json({ results, errors, stopped });
}
