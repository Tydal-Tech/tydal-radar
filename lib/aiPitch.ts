// AI pitch: Claude turns a prospect's signals into a real door pitch — opener,
// the objections THIS prospect will likely raise (with responses), who to ask
// for, and the single strongest angle — in BOTH Québec French and English so
// the rep uses whichever the prospect speaks. Prompt-building + response-parsing
// are pure (unit-tested, shared with the /api/ai/pitch route); the network call
// + cache live in the client helpers at the bottom.

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

/** One language's pitch. */
export interface PitchBody {
  opener: string;
  rebuttals: Rebuttal[];
  askFor: string;
  leadAngle: string;
}

/** Bilingual pitch — Québec French + English. */
export interface AiPitch {
  fr: PitchBody;
  en: PitchBody;
}

export type PitchLang = 'fr' | 'en';

const SYSTEM = `You are a top-performing B2B sales coach for a commercial cleaning company that sells to businesses in Montréal, Québec through door-to-door canvassing.

Given ONE prospect, write a concise, natural, spoken-word door pitch a rep can use immediately. Produce it in BOTH Québec French and English, because the rep won't know which language the prospect speaks until the door opens. The French must read as natural Québécois (not a literal translation), and the English must read as natural English — each idiomatic on its own, same meaning.

Be specific to THIS prospect's signals; never generic filler. Ground the pitch in the signals:
- Newly opened → they likely have no cleaning contract locked in yet; move fast.
- A known incumbent provider → probe satisfaction (reliability, no-shows, price), don't bad-mouth.
- Sole occupant of their address → they control the cleaning decision directly.
- Shared building → cleaning is often the property manager's call; find who decides.
- High rating / many reviews → a spotless space protects the reputation they've built.

Respond with ONLY a JSON object (no markdown, no code fences, no prose) with exactly this shape:
{
  "fr": {
    "opener": "1-2 sentence spoken hook (Québec French)",
    "rebuttals": [{"objection": "...", "response": "..."}],
    "askFor": "the role to ask for at the door, e.g. 'la directrice'",
    "leadAngle": "one sentence: the single strongest reason they'd switch or buy"
  },
  "en": { "opener": "...", "rebuttals": [{"objection": "...", "response": "..."}], "askFor": "...", "leadAngle": "..." }
}
Each rebuttals array holds the 2-3 objections THIS prospect is most likely to raise, each with a confident, non-pushy response.`;

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

const asStr = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function parseBody(o: unknown): PitchBody | null {
  if (!o || typeof o !== 'object') return null;
  const obj = o as Record<string, unknown>;
  const opener = asStr(obj.opener);
  if (!opener) return null;
  const rebuttals: Rebuttal[] = Array.isArray(obj.rebuttals)
    ? (obj.rebuttals as unknown[])
        .slice(0, 3)
        .map((r) => {
          const x = (r ?? {}) as Record<string, unknown>;
          return { objection: asStr(x.objection), response: asStr(x.response) };
        })
        .filter((r) => r.objection && r.response)
    : [];
  return { opener, rebuttals, askFor: asStr(obj.askFor), leadAngle: asStr(obj.leadAngle) };
}

/** Parse Claude's response into a bilingual AiPitch, tolerating fences/prose. Pure. */
export function parsePitch(text: string): AiPitch {
  let s = (text ?? '').trim();
  if (s.startsWith('```')) {
    s = s
      .replace(/^```(?:json)?/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(s) as Record<string, unknown>;
  } catch {
    // Claude sometimes wraps the JSON in prose — grab the outermost { ... }.
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object in AI response');
    obj = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  }
  const fr = parseBody(obj.fr);
  const en = parseBody(obj.en);
  const primary = fr ?? en;
  if (!primary) throw new Error('AI pitch missing content');
  // If a language is missing, fall back to the other so the UI never breaks.
  return { fr: fr ?? primary, en: en ?? primary };
}

// ---- client-only helpers (network + localStorage cache) --------------------

const CACHE_PREFIX = 'tydal-pitch:';

/** Last generated bilingual pitch for a prospect (ignores older cache shapes). */
export function cachedPitch(placeId: string): AiPitch | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + placeId);
    if (!raw) return null;
    const p = JSON.parse(raw) as AiPitch;
    return p?.fr?.opener && p?.en?.opener ? p : null; // guard old (non-bilingual) cache
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
