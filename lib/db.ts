import { supabase } from './supabaseClient';
import type { Prospect, Pipeline } from './types';
import type { PushRow } from './push';

// Build an Error from a failed /api/data/* response that carries the server's
// real reason. The routes return `{ error }` (e.g. a Postgres message like
// "new row violates row-level security policy"), so surfacing it turns a bare
// "(500)" into something diagnosable instead of a mystery.
async function failure(res: Response, action: string): Promise<Error> {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) detail = `: ${String(body.error).slice(0, 200)}`;
  } catch {
    // non-JSON body (gateway/HTML error, or the login redirect) — status is all we have
  }
  return new Error(`${action} failed (${res.status})${detail}`);
}

// Reads go through password-gated server routes (service-role key), so the
// public anon key can be denied all access to prospects/pipeline. The routes
// handle pagination server-side and return the full array.
export async function fetchProspects(): Promise<Prospect[]> {
  const res = await fetch('/api/data/prospects');
  if (!res.ok) throw await failure(res, 'Loading prospects');
  return (await res.json()) as Prospect[];
}

export async function fetchPipeline(): Promise<Pipeline[]> {
  const res = await fetch('/api/data/pipeline');
  if (!res.ok) throw await failure(res, 'Loading pipeline');
  return (await res.json()) as Pipeline[];
}

// Writes go through password-gated server routes (service-role key), so the
// public anon key can be denied write access. Reads below still use anon.

/** Insert new prospects, leaving existing rows untouched (ignore duplicates). */
export async function upsertProspects(rows: Prospect[]): Promise<number> {
  if (rows.length === 0) return 0;
  const res = await fetch('/api/data/prospects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw await failure(res, 'Saving prospects');
  const { count } = (await res.json()) as { count?: number };
  return count ?? rows.length;
}

/** Save the pipeline state for one prospect. */
export async function savePipeline(row: Pipeline): Promise<void> {
  const res = await fetch('/api/data/pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw await failure(res, 'Saving');
}

/** Register (or refresh) a Web Push subscription for follow-up reminders. */
export async function savePushSubscription(row: PushRow): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' });
  if (error) throw error;
}

/** Remove a Web Push subscription (on unsubscribe / expiry). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}
