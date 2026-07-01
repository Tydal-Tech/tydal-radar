import { supabase } from './supabaseClient';
import type { Prospect, Pipeline } from './types';
import type { PushRow } from './push';

// Reads go through password-gated server routes (service-role key), so the
// public anon key can be denied all access to prospects/pipeline. The routes
// handle pagination server-side and return the full array.
export async function fetchProspects(): Promise<Prospect[]> {
  const res = await fetch('/api/data/prospects');
  if (!res.ok) throw new Error(`Loading prospects failed (${res.status})`);
  return (await res.json()) as Prospect[];
}

export async function fetchPipeline(): Promise<Pipeline[]> {
  const res = await fetch('/api/data/pipeline');
  if (!res.ok) throw new Error(`Loading pipeline failed (${res.status})`);
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
  if (!res.ok) throw new Error(`Saving prospects failed (${res.status})`);
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
  if (!res.ok) throw new Error(`Saving failed (${res.status})`);
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
