import { supabase } from './supabaseClient';
import type { Prospect, Pipeline } from './types';
import type { PushRow } from './push';

// PostgREST caps a select at ~1000 rows per request, so fetch in pages and
// concatenate until a short page comes back — otherwise the map silently shows
// only the first 1000 of N prospects. Ordered by the primary key so paging is
// stable across requests.
const PAGE = 1000;

async function fetchAllRows<T>(table: 'prospects' | 'pipeline'): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('place_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function fetchProspects(): Promise<Prospect[]> {
  return fetchAllRows<Prospect>('prospects');
}

export async function fetchPipeline(): Promise<Pipeline[]> {
  return fetchAllRows<Pipeline>('pipeline');
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
