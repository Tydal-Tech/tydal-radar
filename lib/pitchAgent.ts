// The Pitch Writer's actual work (Phase 1): call Claude for one prospect and
// return the parsed bilingual pitch + token usage, shaped as an AgentRunResult
// so it drops straight into runAgent(). Shared by the single-pitch route
// (/api/ai/pitch) and the batch pre-draft route (/api/ai/pitch/batch) — one
// Claude call, one place to change it.

import { buildMessages, parsePitch, type PitchSignals, type AiPitch } from './aiPitch';
import type { AgentRunResult } from './runAgent';

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'UpstreamError';
  }
}

/** Draft one prospect's bilingual pitch via Claude. Throws UpstreamError on any failure. */
export async function draftPitch(
  signals: PitchSignals,
  opts: { key: string; model: string },
): Promise<AgentRunResult<AiPitch>> {
  const { system, user } = buildMessages(signals);

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': opts.key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
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
}
