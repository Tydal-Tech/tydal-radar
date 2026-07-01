import { describe, it, expect } from 'vitest';
import { bestKnockTime } from './timing';
import type { IcpType } from './types';

describe('bestKnockTime', () => {
  it('gives a type-specific window and rationale', () => {
    expect(bestKnockTime('gym').window).toMatch(/off-peak|11 am/i);
    expect(bestKnockTime('daycare').why).toMatch(/nap/i);
    expect(bestKnockTime('office').window).toMatch(/am/i);
  });

  it('has a window + why for every ICP type', () => {
    const types: IcpType[] = ['daycare', 'dental', 'gym', 'office', 'veterinary', 'medical'];
    for (const t of types) {
      const w = bestKnockTime(t);
      expect(w.window).toBeTruthy();
      expect(w.why).toBeTruthy();
    }
  });

  it('falls back for an unknown type', () => {
    expect(bestKnockTime('spaceport' as IcpType).window).toBeTruthy();
  });
});
