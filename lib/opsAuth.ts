// Bearer auth for the external-runner ops endpoints (/api/ops/precheck,
// /api/ops/ingest). GitHub Actions has no app-password session, so these are
// excluded from the proxy gate (proxy.ts) and authenticated with OPS_INGEST_SECRET
// instead — same shape as CRON_SECRET on notify-followups. Unconfigured → open
// (local dev), matching the repo's gate convention.

export function hasIngestAuth(req: Request): boolean {
  const secret = process.env.OPS_INGEST_SECRET;
  if (!secret) return true; // unconfigured → open (set OPS_INGEST_SECRET in prod)
  return req.headers.get('authorization') === `Bearer ${secret}`;
}
