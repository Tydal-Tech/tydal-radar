import { NextResponse } from 'next/server';
import { buildMessages, parsePitch, type PitchSignals } from '@/lib/aiPitch';

// Server-only so the Anthropic key never reaches the client bundle. This route
// is gated by the app password (proxy.ts) — only the authenticated app calls it,
// which also stops anyone from burning the key. Set ANTHROPIC_API_KEY (and
// optionally ANTHROPIC_MODEL) in the environment.
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

  const { system, user } = buildMessages(signals);

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        temperature: 0.7,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach Claude' }, { status: 502 });
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return NextResponse.json(
      { error: `Claude error (${resp.status})`, detail: detail.slice(0, 200) },
      { status: 502 },
    );
  }

  const data = (await resp.json().catch(() => null)) as { content?: { text?: string }[] } | null;
  const text = data?.content?.[0]?.text ?? '';
  try {
    return NextResponse.json(parsePitch(text));
  } catch {
    return NextResponse.json({ error: 'Could not parse the AI response' }, { status: 502 });
  }
}
