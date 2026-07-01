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
  it('asks for both French and English and grounds in the signals', () => {
    const { system, user } = buildMessages(signals);
    expect(system).toMatch(/Québec French and English/i);
    expect(user).toContain('Acme Dental');
    expect(user).toContain('GDI');
    expect(user).toMatch(/sole occupant/i);
  });

  it('reflects newly-opened and shared-building states', () => {
    const u = buildMessages({ ...signals, incumbent: null, newlyOpened: true, building: 'shared' }).user;
    expect(u).toMatch(/Newly opened: yes/);
    expect(u).toMatch(/property manager/i);
  });
});

const good = JSON.stringify({
  fr: {
    opener: 'Bonjour — une petite question sur votre ménage commercial.',
    rebuttals: [{ objection: 'On est satisfaits', response: 'Parfait — je laisse une soumission au cas où.' }],
    askFor: 'la directrice',
    leadAngle: 'Protégez votre réputation de 4,8 étoiles.',
  },
  en: {
    opener: 'Hi — quick question about your commercial cleaning.',
    rebuttals: [{ objection: "We're happy", response: "Great — I'll leave a quote just in case." }],
    askFor: 'the office manager',
    leadAngle: 'Protect your 4.8-star reputation.',
  },
});

describe('parsePitch', () => {
  it('parses both language bodies', () => {
    const p = parsePitch(good);
    expect(p.fr.opener).toMatch(/ménage|Bonjour/);
    expect(p.en.opener).toMatch(/cleaning/);
    expect(p.fr.askFor).toBe('la directrice');
    expect(p.en.askFor).toBe('the office manager');
    expect(p.fr.rebuttals).toHaveLength(1);
  });

  it('tolerates ```json code fences and surrounding prose', () => {
    expect(parsePitch('```json\n' + good + '\n```').fr.opener).toMatch(/Bonjour/);
    expect(parsePitch('Here you go:\n' + good + '\nGood luck!').en.opener).toMatch(/cleaning/);
  });

  it('falls back to the other language if one is missing', () => {
    const frOnly = JSON.stringify({ fr: { opener: 'Bonjour', rebuttals: [], askFor: '', leadAngle: '' } });
    const p = parsePitch(frOnly);
    expect(p.en.opener).toBe('Bonjour'); // en falls back to fr
  });

  it('drops malformed rebuttals and caps at 3', () => {
    const p = parsePitch(
      JSON.stringify({
        en: {
          opener: 'Hi',
          rebuttals: [
            { objection: 'a', response: 'b' },
            { objection: 'no-response' },
            { objection: 'c', response: 'd' },
            { objection: 'e', response: 'f' },
            { objection: 'g', response: 'h' },
          ],
        },
      }),
    );
    expect(p.en.rebuttals.every((r) => r.objection && r.response)).toBe(true);
    expect(p.en.rebuttals.length).toBeLessThanOrEqual(3);
  });

  it('throws when there is no usable content', () => {
    expect(() => parsePitch(JSON.stringify({ fr: { rebuttals: [] } }))).toThrow();
    expect(() => parsePitch('not json')).toThrow();
  });
});
