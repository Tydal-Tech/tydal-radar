import { describe, it, expect } from 'vitest';
import { pitch } from './pitch';
import type { ProspectView } from './types';
import type { Stage } from './stages';

function v(stage: Stage, p: Partial<ProspectView> = {}): ProspectView {
  return {
    place_id: 'x',
    name: 'Acme Dental',
    type: 'dental',
    neighborhood: 'NDG',
    lat: 45.5,
    lng: -73.57,
    phone: null,
    address: '1 Main St',
    rating: null,
    user_rating_count: null,
    website: null,
    stage,
    note: null,
    contact_name: null,
    current_provider: null,
    contract_expiry: null,
    follow_up_date: null,
    lost_reason: null,
    stage_updated_at: null,
    ...p,
  };
}

describe('pitch', () => {
  it('leads with the "just opened" angle for a newly-opened business', () => {
    const fresh = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const p = pitch(v('not_knocked', { first_seen: fresh }));
    expect(p.opener).toMatch(/opening/i);
    expect(p.angles.join(' ')).toMatch(/no contract yet/i);
  });

  it('probes the incumbent when one is recorded', () => {
    const p = pitch(v('talked', { current_provider: 'GDI' }));
    expect(p.opener).toMatch(/GDI/);
    expect(p.angles.join(' ')).toMatch(/GDI/);
  });

  it('asks who decides in a shared building', () => {
    const p = pitch(v('not_knocked'), { known: true, soleOccupant: false, count: 4 });
    expect(p.opener).toMatch(/property manager|building/i);
  });

  it('adds urgency and reputation angles when relevant', () => {
    const p = pitch(v('quoted', { follow_up_date: '2000-01-01', rating: 4.8 }));
    expect(p.angles.join(' ')).toMatch(/press for a decision/i);
    expect(p.angles.join(' ')).toMatch(/4\.8/);
  });

  it('always returns a usable default opener', () => {
    expect(pitch(v('not_knocked')).opener).toBeTruthy();
  });
});
