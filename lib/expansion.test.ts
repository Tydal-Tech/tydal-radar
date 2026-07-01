import { describe, it, expect } from 'vitest';
import { chainKey, expansionTargets, isGenericName } from './expansion';
import type { ProspectView } from './types';
import type { Stage } from './stages';

function v(id: string, over: Partial<ProspectView> = {}): ProspectView {
  return {
    place_id: id,
    name: id,
    type: 'gym',
    neighborhood: 'NDG',
    lat: 45.5,
    lng: -73.57,
    phone: null,
    address: '1 Main St',
    rating: null,
    user_rating_count: null,
    website: null,
    stage: 'not_knocked' as Stage,
    note: null,
    contact_name: null,
    current_provider: null,
    contract_expiry: null,
    follow_up_date: null,
    lost_reason: null,
    stage_updated_at: null,
    ...over,
  };
}

describe('chainKey', () => {
  it('is accent- and punctuation-insensitive', () => {
    expect(chainKey('Café Éllul!')).toBe(chainKey('cafe ellul'));
  });
});

describe('isGenericName', () => {
  it('flags names made only of industry/descriptor words', () => {
    expect(isGenericName('Clinique Dentaire')).toBe(true);
    expect(isGenericName('Garderie Éducative')).toBe(true);
    expect(isGenericName('Centre Médical')).toBe(true);
  });
  it('does not flag names with a distinctive brand token', () => {
    expect(isGenericName('Anytime Fitness')).toBe(false);
    expect(isGenericName('Clinique Dentaire Lapointe')).toBe(false);
    expect(isGenericName('Tim Hortons')).toBe(false);
  });
});

describe('expansionTargets', () => {
  const client = v('client', { name: 'Anytime Fitness', address: '500 Tower Rd, Suite 100', stage: 'client' });
  const all = [
    client,
    v('cotenant', { name: 'Dr. Smith', address: '500 Tower Rd, Suite 200' }), // same building
    v('sister', { name: 'Anytime Fitness', address: '99 Other Ave' }), // same chain elsewhere
    v('unrelated', { name: 'Joe Gym', address: '77 Far St' }),
    v('alreadyClient', { name: 'Anytime Fitness', address: '12 Won St', stage: 'client' }), // excluded
  ];

  it('finds co-tenants in the same building', () => {
    const { sameBuilding } = expansionTargets(client, all);
    expect(sameBuilding.map((p) => p.place_id)).toEqual(['cotenant']);
  });

  it('finds sister locations of the same chain, excluding existing clients', () => {
    const { sisters } = expansionTargets(client, all);
    expect(sisters.map((p) => p.place_id)).toEqual(['sister']);
  });

  it('never includes the client itself or unrelated businesses', () => {
    const { sameBuilding, sisters } = expansionTargets(client, all);
    const ids = [...sameBuilding, ...sisters].map((p) => p.place_id);
    expect(ids).not.toContain('client');
    expect(ids).not.toContain('unrelated');
    expect(ids).not.toContain('alreadyClient');
  });

  it('suppresses sisters for a generic-named client (no false chains)', () => {
    const generic = v('gClient', { name: 'Clinique Dentaire', address: '1 A St', stage: 'client' });
    const others = [
      generic,
      v('g2', { name: 'Clinique Dentaire', address: '2 B St' }), // same generic name, unrelated
    ];
    expect(expansionTargets(generic, others).sisters).toEqual([]);
  });
});
