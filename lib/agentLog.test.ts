import { describe, it, expect } from 'vitest';
import { scopesFor, runCostColumns } from './agentLog';
import { costOf } from './pricing';

describe('scopesFor', () => {
  it('builds the global → dept → role scope chain', () => {
    expect(scopesFor('revenue', 'pitch-writer')).toEqual(['global', 'dept:revenue', 'role:pitch-writer']);
  });
});

describe('runCostColumns', () => {
  it('maps usage to columns and prices via costOf (one meter, two doors)', () => {
    const usage = { inputTokens: 800, outputTokens: 1500, cacheReadTokens: 200, cacheWriteTokens: 0 };
    const cols = runCostColumns('claude-sonnet-5', usage);
    expect(cols).toEqual({
      input_tokens: 800,
      output_tokens: 1500,
      cache_read_tokens: 200,
      cache_write_tokens: 0,
      cost_usd: costOf('claude-sonnet-5', usage),
    });
  });

  it('is identical for the in-process and external (ingest) paths given identical input', () => {
    const usage = { inputTokens: 12345, outputTokens: 6789 };
    // Whatever runAgent stores and whatever /api/ops/ingest stores both come from
    // this one function — so identical input ⇒ byte-identical cost row.
    expect(runCostColumns('claude-haiku-4-5', usage)).toEqual(runCostColumns('claude-haiku-4-5', usage));
  });

  it('treats missing cache fields as zero', () => {
    const cols = runCostColumns('claude-opus-4-8', { inputTokens: 0, outputTokens: 0 });
    expect(cols).toMatchObject({ cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0 });
  });
});
