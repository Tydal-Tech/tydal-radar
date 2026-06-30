import { describe, it, expect } from 'vitest';
import {
  STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  STAGE_ON_COLOR,
  FUNNEL_RANK,
  reachedRank,
  LOST_REASONS,
  LOST_REASON_LABELS,
  type Stage,
} from './stages';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('STAGES', () => {
  it('has 8 unique stages', () => {
    expect(STAGES).toHaveLength(8);
    expect(new Set(STAGES).size).toBe(8);
  });

  it('every map is keyed by exactly the STAGES set', () => {
    const expected = [...STAGES].sort();
    for (const map of [STAGE_LABELS, STAGE_COLORS, STAGE_ON_COLOR, FUNNEL_RANK]) {
      expect(Object.keys(map).sort()).toEqual(expected);
    }
  });

  it.each(STAGES)('%s has a non-empty label and valid colors', (stage) => {
    expect(STAGE_LABELS[stage].length).toBeGreaterThan(0);
    expect(STAGE_COLORS[stage]).toMatch(HEX);
    expect(STAGE_ON_COLOR[stage]).toMatch(HEX);
  });
});

describe('FUNNEL_RANK / reachedRank', () => {
  it.each(STAGES)('reachedRank(%s) mirrors FUNNEL_RANK', (stage) => {
    expect(reachedRank(stage)).toBe(FUNNEL_RANK[stage]);
  });

  it('encodes the funnel: not_knocked=0 .. client=4', () => {
    const expected: Record<Stage, number> = {
      not_knocked: 0,
      knocked: 1,
      not_interested: 1,
      talked: 2,
      follow_up: 2,
      quoted: 3,
      lost: 3,
      client: 4,
    };
    for (const s of STAGES) expect(FUNNEL_RANK[s]).toBe(expected[s]);
  });

  it('client is the unique max rank', () => {
    const max = Math.max(...STAGES.map(reachedRank));
    expect(max).toBe(4);
    expect(STAGES.filter((s) => reachedRank(s) === 4)).toEqual(['client']);
  });
});

describe('LOST_REASONS', () => {
  it('has 5 reasons matching the label map keys', () => {
    expect(LOST_REASONS).toHaveLength(5);
    expect(Object.keys(LOST_REASON_LABELS).sort()).toEqual([...LOST_REASONS].sort());
  });

  it.each(LOST_REASONS)('%s has a non-empty label', (reason) => {
    expect(LOST_REASON_LABELS[reason].length).toBeGreaterThan(0);
  });
});
