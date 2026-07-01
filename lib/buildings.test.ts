import { describe, it, expect } from 'vitest';
import { buildingKey, buildIndex, coLocation } from './buildings';

describe('buildingKey', () => {
  it('takes the street segment, lowercased, unit stripped', () => {
    expect(buildingKey('1250 René-Lévesque, Suite 400, Montréal, QC')).toBe('1250 rené-lévesque');
    expect(buildingKey('1250 René-Lévesque, Bureau 900')).toBe('1250 rené-lévesque');
    expect(buildingKey('88 Main St #12')).toBe('88 main st');
  });

  it('is null for missing address', () => {
    expect(buildingKey(null)).toBeNull();
    expect(buildingKey('')).toBeNull();
    expect(buildingKey(undefined)).toBeNull();
  });

  it('collapses two units of the same tower to one key', () => {
    expect(buildingKey('500 Place d’Armes, Suite 1800')).toBe(
      buildingKey('500 Place d’Armes, Bureau 200'),
    );
  });
});

describe('coLocation', () => {
  const prospects = [
    { place_id: 'a', address: '500 Tower Rd, Suite 100' },
    { place_id: 'b', address: '500 Tower Rd, Suite 200' },
    { place_id: 'c', address: '500 Tower Rd, Bureau 900' },
    { place_id: 'd', address: '12 Standalone Ave' },
    { place_id: 'e', address: null },
  ];
  const index = buildIndex(prospects);

  it('flags a shared building with the co-tenants', () => {
    const co = coLocation(index, prospects[0]);
    expect(co).toMatchObject({ known: true, count: 3, soleOccupant: false });
    expect(co.others.sort()).toEqual(['b', 'c']);
  });

  it('flags a sole occupant (controls own cleaning)', () => {
    expect(coLocation(index, prospects[3])).toMatchObject({
      known: true,
      count: 1,
      soleOccupant: true,
      others: [],
    });
  });

  it('reports unknown for an address-less prospect', () => {
    expect(coLocation(index, prospects[4])).toMatchObject({ known: false, soleOccupant: false });
  });
});
