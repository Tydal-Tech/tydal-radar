# AI pitch (Claude)

On the prospect card, **✨ Draft with AI** turns the prospect's signals into a
real door pitch — opener, the objections *this* prospect is likely to raise (with
responses), who to ask for, and the single strongest angle. It replaces the
templated Playbook text (which stays as the offline / not-configured fallback).

## How it works

- Client sends the prospect's signals to **`/api/ai/pitch`** (a server route, so
  the API key never reaches the browser). The route is behind the app password
  gate, so only the authenticated app can spend the key.
- The route calls Claude (`claude-sonnet-5` by default) and returns
  `{ opener, rebuttals[], askFor, leadAngle }`.
- The result is cached in `localStorage` per prospect, so re-opening the card is
  instant and works offline. Tap **↻ Regenerate** for a fresh take.
- Prompt-building and response-parsing live in `lib/aiPitch.ts` (pure, unit-tested
  and shared with the route).

## Setup

Add to `.env.local` (local) **and** the Vercel project env:

```
ANTHROPIC_API_KEY=sk-ant-...        # required — keep secret, never commit
ANTHROPIC_MODEL=claude-sonnet-5     # optional override
```

`.env.local` is git-ignored. **Never paste the key into code, chat, or a tracked
file.** If a key is ever exposed, rotate it at console.anthropic.com.

## Cost / behavior notes

- One request per **Draft/Regenerate** tap (not automatic) — you control spend.
- Pre-generate on Wi-Fi before canvassing; the cache serves it in the field.
- If `ANTHROPIC_API_KEY` is unset, the route returns 503 and the card falls back
  to the templated pitch — nothing breaks.
