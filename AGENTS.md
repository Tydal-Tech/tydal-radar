<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent guardrails

Rules for any automated/managed agent working in this repo. Humans: same spirit applies.

## Verify before you ship
Every change must pass all three, locally and in CI, before merge:
- `npx tsc --noEmit`
- `npm test`
- `npm run build`

CI (`.github/workflows/ci.yml`) runs these on every push and pull request. (Lint has known, deliberately-deferred `react-hooks` warnings, so it is not a hard gate — don't let it block, but don't add new lint errors either.)

## Branch, don't push to main
`main` **auto-deploys to production** (the live PWA on the user's phone). Do your work on a branch and open a pull request; let CI + the Vercel preview deploy validate it before it merges. Never push experimental or unverified work straight to `main`.

## Secrets — never handle in the clear
- Never print, log, echo, commit, or paste secret values: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, or any key/token.
- Secrets live **only** in `.env.local` (git-ignored) and the Vercel project env. `.env.local` must never be committed.
- Reference secrets via `process.env.*` in server code only — never ship a secret to the client bundle (only `NEXT_PUBLIC_*` is safe there).

## Money & billing
Never make purchases, add or change billing/payment methods, or take actions that spend beyond a configured cap. Anthropic (pitch) and Google Places (scrape) both cost money — flag spend, don't commit the user to it.

## Production data
- Read-only queries for exploration. Do **not** run destructive SQL (`DELETE`/`DROP`/`TRUNCATE`) or schema migrations against the production database without explicit human approval; prefer a staging DB.
- Take a backup (`scripts/backup.mjs`) before any bulk data operation.
- If a gate or classifier blocks an action, surface it and hand the human the exact SQL/steps — do **not** try to circumvent it.

## Keep the record straight
Update `CHANGELOG.md` and `TYDAL_PROGRESS.md` (loop memory); use conventional commit messages. Report failures honestly with the actual output.
