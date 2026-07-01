import { describe, it, expect } from 'vitest';
import { costOf, RATES } from './pricing';

describe('costOf', () => {
  it('prices input + output at the model rate', () => {
    // Sonnet 5: $2/1M in, $10/1M out. 1M in + 1M out = $2 + $10 = $12.
    expect(costOf('claude-sonnet-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(12, 6);
  });

  it('discounts cache reads to 0.1x and charges cache writes at 1.25x of input', () => {
    // Haiku: $1/1M in. 1M cache-read = $0.10; 1M cache-write = $1.25.
    expect(costOf('claude-haiku-4-5', { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 })).toBeCloseTo(0.1, 6);
    expect(costOf('claude-haiku-4-5', { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000_000 })).toBeCloseTo(1.25, 6);
  });

  it('scales to realistic small runs', () => {
    // A bilingual pitch on Sonnet 5 ~ 800 in + 1500 out.
    const c = costOf('claude-sonnet-5', { inputTokens: 800, outputTokens: 1500 });
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(0.05); // ~1.7¢
  });

  it('is cheaper on Haiku than Opus for the same usage', () => {
    const u = { inputTokens: 100_000, outputTokens: 10_000 };
    expect(costOf('claude-haiku-4-5', u)).toBeLessThan(costOf('claude-opus-4-8', u));
  });

  it('falls back to Sonnet 5 rates for an unknown model', () => {
    const u = { inputTokens: 1_000_000, outputTokens: 0 };
    expect(costOf('some-future-model', u)).toBeCloseTo(costOf('claude-sonnet-5', u), 6);
  });

  it('treats missing cache fields as zero', () => {
    expect(costOf('claude-opus-4-8', { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it('exposes rate cards for the three tiers', () => {
    expect(RATES['claude-haiku-4-5']).toEqual({ in: 1, out: 5 });
    expect(RATES['claude-opus-4-8']).toEqual({ in: 5, out: 25 });
  });
});
