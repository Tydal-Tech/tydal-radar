// AI pitch: Claude turns a prospect's signals into a real door pitch — opener,
// the objections THIS prospect will likely raise (with responses), who to ask
// for, and the single strongest angle. The prompt-building + response-parsing
// are pure (unit-tested and shared with the /api/ai/pitch route); the network
// call + cache live in the client helpers at the bottom.

export interface PitchSignals {
  name: string;
  typeLabel: string; // e.g. "Dental clinic"
  neighborhood: string;
  rating: number | null;
  reviews: number | null;
  incumbent: string | null; // current cleaning provider, if known
  newlyOpened: boolean;
  building: 'sole' | 'shared' | 'unknown';
  hasWebsite: boolean;
}

export interface Rebuttal {
  objection: string;
  response: string;
}

export interface AiPitch {
  opener: string;
  rebuttals: Rebuttal[];
  askFor: string;
  leadAngle: string;
}

const SYSTEM = `You are a top-performing B2B sales coach for a commercial cleaning company that sells to businesses in Montréal, Québec through door-to-door canvassing.

Given ONE prospect, write a concise, natural, spoken-word door pitch a rep can use immediately. Montréal is bilingual — keep it in English but warm and locally aware. Be specific to THIS prospect's signals; never generic filler.

Ground the pitch in the signals:
- Newly opened → they likely have no cleaning contract locked in yet; move fast.
- A known incumbent provider → probe satisfaction (reliability, no-shows, price), don't bad-mouth.
- Sole occupant of their address → they control the cleaning decision directly.
- Shared building → cleaning is often the property manager's call; find who decides.
- High rating / many reviews → a spotless space protects the reputation they've built.

Respond with ONLY a JSON object (no markdown, no code fences, no prose) with exactly these keys:
{
  "opener": "1-2 sentence spoken hook",
  "rebuttals": [{"objection": "...", "response": "..."}],  // the 2-3 objections THIS prospect is most likely to raise, each with a confident, non-pushy response
  "askFor": "the single role to ask for at the door, e.g. 'the office manager'",
  "leadAngle": "one sentence naming the single strongest reason they'd switch or buy"
}`;

/** Build the Anthropic system + user messages for a prospect. Pure. */
export function buildMessages(s: PitchSignals): { system: string; user: string } {
  const facts = [
    `Business: ${s.name}`,
    `Type: ${s.typeLabel}`,
    `Neighborhood: ${s.neighborhood}`,
    s.rating != null ? `Google rating: ${s.rating}★ (${s.reviews ?? 0} reviews)` : `Rating: unknown`,
    `Current cleaning provider: ${s.incumbent ? s.incumbent : 'none recorded'}`,
    `Newly opened: ${s.newlyOpened ? 'yes' : 'no'}`,
    `Premises: ${
      s.building === 'sole'
        ? 'sole occupant of its address (controls its own cleaning)'
        : s.building === 'shared'
          ? 'shares a multi-tenant building (cleaning may be the property manager’s call)'
          : 'unknown'
    }`,
    `Has a website: ${s.hasWebsite ? 'yes' : 'no'}`,
  ].join('\n');
  return { system: SYSTEM, user: `Prospect:\n${facts}` };
}

/** Parse Claude's response into an AiPitch, tolerating stray code fences. Pure. */
export function parsePitch(text: string): AiPitch {
  let s = (text ?? '').trim();
  if (s.startsWith('```')) {
    s = s
      .replace(/^```(?:json)?/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  const obj = JSON.parse(s) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const opener = str(obj.opener);
  if (!opener) throw new Error('AI pitch missing an opener');
  const rebuttals: Rebuttal[] = Array.isArray(obj.rebuttals)
    ? (obj.rebuttals as unknown[])
        .slice(0, 3)
        .map((r) => {
          const o = (r ?? {}) as Record<string, unknown>;
          return { objection: str(o.objection), response: str(o.response) };
        })
        .filter((r) => r.objection && r.response)
    : [];
  return { opener, rebuttals, askFor: str(obj.askFor), leadAngle: str(obj.leadAngle) };
}

// ---- client-only helpers (network + localStorage cache) --------------------

const CACHE_PREFIX = 'tydal-pitch:';

/** Last generated pitch for a prospect, cached locally so re-opening is instant/offline. */
export function cachedPitch(placeId: string): AiPitch | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + placeId);
    return raw ? (JSON.parse(raw) as AiPitch) : null;
  } catch {
    return null;
  }
}

/** Call the server route (which holds the API key) and cache the result. */
export async function generatePitch(placeId: string, signals: PitchSignals): Promise<AiPitch> {
  const res = await fetch('/api/ai/pitch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(signals),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ? `${body.error}` : `AI request failed (${res.status})`);
  }
  const pitch = (await res.json()) as AiPitch;
  try {
    window.localStorage.setItem(CACHE_PREFIX + placeId, JSON.stringify(pitch));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
  return pitch;
}
