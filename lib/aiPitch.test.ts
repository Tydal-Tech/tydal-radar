import { describe, it, expect } from 'vitest';
import { buildMessages, parsePitch, type PitchSignals } from './aiPitch';

const signals: PitchSignals = {
  name: 'Acme Dental',
  typeLabel: 'Dental clinic',
  neighborhood: 'NDG',
  rating: 4.8,
  reviews: 210,
  incumbent: 'GDI',
  newlyOpened: false,
  building: 'sole',
  hasWebsite: true,
};

describe('buildMessages', () => {
  it('grounds the user message in the prospect signals', () => {
    const { system, user } = buildMessages(signals);
    expect(system).toMatch(/commercial cleaning/i);
    expect(user).toContain('Acme Dental');
    expect(user).toContain('Dental clinic');
    expect(user).toContain('4.8');
    expect(user).toContain('GDI');
    expect(user).toMatch(/sole occupant/i);
  });

  it('reflects newly-opened and shared-building states', () => {
    const u = buildMessages({ ...signals, incumbent: null, newlyOpened: true, building: 'shared' }).user;
    expect(u).toMatch(/Newly opened: yes/);
    expect(u).toMatch(/property manager/i);
    expect(u).toMatch(/none recorded/i);
  });
});

describe('parsePitch', () => {
  const good = JSON.stringify({
    opener: 'Hi — quick question about your cleaning.',
    rebuttals: [
      { objection: "We're happy with our cleaner", response: 'Totally fair — what would make you even happier?' },
      { objection: 'Too expensive', response: 'Let me quote it — you might be overpaying now.' },
    ],
    askFor: 'the office manager',
    leadAngle: 'A spotless clinic protects your 4.8★ reputation.',
  });

  it('parses a clean JSON response', () => {
    const p = parsePitch(good);
    expect(p.opener).toMatch(/cleaning/);
    expect(p.rebuttals).toHaveLength(2);
    expect(p.askFor).toBe('the office manager');
    expect(p.leadAngle).toMatch(/reputation/);
  });

  it('tolerates ```json code fences', () => {
    expect(parsePitch('```json\n' + good + '\n```').opener).toMatch(/cleaning/);
  });

  it('extracts the JSON even when Claude wraps it in prose', () => {
    expect(parsePitch('Here is your pitch:\n' + good + '\n\nGood luck!').opener).toMatch(/cleaning/);
  });

  it('drops malformed rebuttals and caps at 3', () => {
    const p = parsePitch(
      JSON.stringify({
        opener: 'Hi',
        rebuttals: [
          { objection: 'a', response: 'b' },
          { objection: 'only-objection' }, // no response → dropped
          { objection: 'c', response: 'd' },
          { objection: 'e', response: 'f' },
          { objection: 'g', response: 'h' }, // beyond 3 → sliced
        ],
      }),
    );
    expect(p.rebuttals.every((r) => r.objection && r.response)).toBe(true);
    expect(p.rebuttals.length).toBeLessThanOrEqual(3);
  });

  it('throws when there is no opener', () => {
    expect(() => parsePitch(JSON.stringify({ rebuttals: [] }))).toThrow();
    expect(() => parsePitch('not json')).toThrow();
  });
});
