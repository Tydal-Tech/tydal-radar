import { describe, it, expect } from 'vitest';
import { diffProspects } from './snapshot-diff';

const p = (place_id: string, type = 'dental') => ({ place_id, type, name: place_id });

describe('diffProspects', () => {
  it('finds added and removed by place_id', () => {
    const older = [p('a'), p('b', 'gym')];
    const newer = [p('b', 'gym'), p('c'), p('d', 'gym')];
    const d = diffProspects(older, newer);
    expect(d.added.map((x) => x.place_id).sort()).toEqual(['c', 'd']);
    expect(d.removed.map((x) => x.place_id)).toEqual(['a']);
  });

  it('breaks down added/removed by type', () => {
    const d = diffProspects(
      [p('a', 'gym')],
      [p('b', 'dental'), p('c', 'dental'), p('d', 'gym')],
    );
    expect(d.addedByType).toEqual({ dental: 2, gym: 1 });
    expect(d.removedByType).toEqual({ gym: 1 });
  });

  it('is empty when the snapshots are identical', () => {
    const d = diffProspects([p('a'), p('b')], [p('a'), p('b')]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.addedByType).toEqual({});
  });
});
