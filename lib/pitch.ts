// Grounded talk-track: a tailored door opener built from a prospect's actual
// signals (newly opened, incumbent, sole occupant, size/rating). Templated (no
// LLM) so it's deterministic, offline and unit-testable — the 🟢 version of the
// pitch generator (upgrade to an LLM-grounded one later, 🟣).

import type { ProspectView } from './types';
import { isNewlyOpened } from './score';
import { urgency } from './contracts';

export interface Pitch {
  opener: string;
  angles: string[];
}

export function pitch(
  v: ProspectView,
  co?: { known: boolean; soleOccupant: boolean; count: number },
): Pitch {
  const angles: string[] = [];
  let opener: string;

  if (isNewlyOpened(v.first_seen)) {
    opener = `Congrats on opening ${v.name}! Have you locked in a commercial cleaning provider yet?`;
    angles.push('Newly opened — likely no contract yet; get in before competitors do.');
  } else if (v.current_provider) {
    opener = `Hi — I keep places around ${v.neighborhood} spotless. How happy are you with ${v.current_provider} for your cleaning?`;
    angles.push(`Incumbent: ${v.current_provider} — probe on price, reliability and no-shows.`);
  } else if (co && co.known && !co.soleOccupant) {
    opener = `Hi — do you arrange your own cleaning here, or does the property manager handle it for the building?`;
    angles.push('Shared building — confirm who decides; you may need the property manager.');
  } else {
    opener = `Hi — I help businesses in ${v.neighborhood} stay spotless without the hassle. Who looks after your cleaning right now?`;
  }

  if (urgency(v) === 'red')
    angles.push('Timing: contract expiring / follow-up due — press for a decision.');
  if ((v.rating ?? 0) >= 4.5)
    angles.push(`They protect a ${v.rating}★ reputation — a spotless space keeps it.`);
  if (co?.known && co.soleOccupant)
    angles.push('Sole occupant — they control the cleaning decision directly.');

  return { opener, angles };
}
