import { describe, it, expect } from 'vitest';
import { parseIngest } from './opsIngest';
import { costOf } from './pricing';

const base = { role: 'feature-engineer', department: 'engineering', model: 'claude-sonnet-5' };

describe('parseIngest', () => {
  it('rejects bodies missing role/department/model', () => {
    expect(() => parseIngest(null)).toThrow();
    expect(() => parseIngest({})).toThrow();
    expect(() => parseIngest({ role: 'x', department: 'y' })).toThrow(); // no model
  });

  it('accepts a minimal valid run and defaults status/trigger', () => {
    const i = parseIngest(base);
    expect(i.status).toBe('success');
    expect(i.triggeredBy).toBe('schedule'); // external default
    expect(i.usage).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(i.task).toBeNull();
    expect(i.escalated).toBe(false);
  });

  it('coerces usage numbers and drops negatives/garbage to 0', () => {
    const i = parseIngest({ ...base, usage: { inputTokens: 1200, outputTokens: -5, cacheReadTokens: 'x' } });
    expect(i.usage.inputTokens).toBe(1200);
    expect(i.usage.outputTokens).toBe(0);
    expect(i.usage.cacheReadTokens).toBe(0);
    // The cost the route will store matches the pricing module exactly.
    expect(costOf(i.model, i.usage)).toBeCloseTo(costOf('claude-sonnet-5', { inputTokens: 1200, outputTokens: 0 }), 9);
  });

  it('only allows known statuses and triggers, else falls back', () => {
    expect(parseIngest({ ...base, status: 'exploded' }).status).toBe('success');
    expect(parseIngest({ ...base, status: 'error' }).status).toBe('error');
    expect(parseIngest({ ...base, triggered_by: 'human' }).triggeredBy).toBe('human');
    expect(parseIngest({ ...base, triggered_by: 'nonsense' }).triggeredBy).toBe('schedule');
  });

  it('accepts a valid task and marks escalation runs escalated', () => {
    const pr = parseIngest({ ...base, task: { kind: 'pr', title: 'Bump deps', link: 'http://x/1' } });
    expect(pr.task).toMatchObject({ kind: 'pr', title: 'Bump deps', link: 'http://x/1' });
    expect(pr.escalated).toBe(false);
    const esc = parseIngest({ ...base, task: { kind: 'escalation', title: 'touches auth' } });
    expect(esc.escalated).toBe(true); // an escalation task forces escalated
  });

  it('ignores malformed tasks', () => {
    expect(parseIngest({ ...base, task: { kind: 'bogus', title: 'x' } }).task).toBeNull();
    expect(parseIngest({ ...base, task: { kind: 'pr' } }).task).toBeNull(); // no title
  });

  it('truncates a runaway error string (never dump a full diff)', () => {
    const i = parseIngest({ ...base, status: 'error', error: 'e'.repeat(5000) });
    expect(i.error!.length).toBe(500);
  });
});
