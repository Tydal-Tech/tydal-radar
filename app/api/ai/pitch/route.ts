import { NextResponse } from 'next/server';
import { buildMessages, parsePitch, type PitchSignals, type AiPitch } from '@/lib/aiPitch';
import { runAgent, BudgetError } from '@/lib/runAgent';

// Server-only so the Anthropic key never reaches the client bundle. This route
// is gated by the app password (proxy.ts) — only the authenticated app calls it,
// which also stops anyone from burning the key. Set ANTHROPIC_API_KEY (and
// optionally ANTHROPIC_MODEL) in the environment. Runs through runAgent so every
// pitch is budgeted + logged (Phase 0).
export const runtime = 'nodejs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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

  try {
    const { result } = await runAgent<AiPitch>({
      role: 'pitch-writer',
      department: 'revenue',
      model: MODEL,
      run: async () => {
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
              max_tokens: 2500,
              system,
              messages: [{ role: 'user', content: user }],
            }),
          });
        } catch {
          throw new UpstreamError(502, 'Could not reach Claude');
        }
        if (!resp.ok) {
          const detail = await resp.text().catch(() => '');
          throw new UpstreamError(502, `Claude error (${resp.status})${detail ? `: ${detail.slice(0, 120)}` : ''}`);
        }
        const data = (await resp.json().catch(() => null)) as {
          content?: { type?: string; text?: string }[];
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
          id?: string;
        } | null;
        // Sonnet 5 can return non-text blocks first, so pick the text block explicitly.
        const text = (data?.content ?? []).find((b) => b?.type === 'text')?.text ?? '';
        if (!text) throw new UpstreamError(502, 'The AI returned an empty response');
        let pitch: AiPitch;
        try {
          pitch = parsePitch(text);
        } catch {
          throw new UpstreamError(502, 'Could not parse the AI response');
        }
        const u = data?.usage ?? {};
        return {
          result: pitch,
          usage: {
            inputTokens: u.input_tokens ?? 0,
            outputTokens: u.output_tokens ?? 0,
            cacheReadTokens: u.cache_read_input_tokens ?? 0,
            cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
          },
          requestId: data?.id,
        };
      },
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
