// Cost model for AI-org agent runs (Phase 0 — see docs/phase-0-observability.md).
// Single source of truth for what a Claude call costs. Prices are $ per 1M
// tokens; cache reads bill ~0.1x and cache writes ~1.25x of the input rate.
// Cost is computed on write and stored on the run row, so historical spend is
// fixed even when these rates change.

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

// $/1M tokens. Update the Sonnet 5 row to { in: 3, out: 15 } after the
// 2026-08-31 introductory period ends.
export const RATES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-opus-4-8': { in: 5, out: 25 },
};

const DEFAULT_MODEL = 'claude-sonnet-5';

/** Dollar cost of one call. Unknown models fall back to Sonnet 5 rates. */
export function costOf(model: string, u: Usage): number {
  const r = RATES[model] ?? RATES[DEFAULT_MODEL];
  const input = (u.inputTokens ?? 0) * r.in;
  const cacheRead = (u.cacheReadTokens ?? 0) * r.in * 0.1;
  const cacheWrite = (u.cacheWriteTokens ?? 0) * r.in * 1.25;
  const output = (u.outputTokens ?? 0) * r.out;
  return (input + cacheRead + cacheWrite + output) / 1_000_000;
}
