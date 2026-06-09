import { supabase } from './supabaseClient';
import type { Prospect, Pipeline } from './types';

export async function fetchProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase.from('prospects').select('*');
  if (error) throw error;
  return (data ?? []) as Prospect[];
}

export async function fetchPipeline(): Promise<Pipeline[]> {
  const { data, error } = await supabase.from('pipeline').select('*');
  if (error) throw error;
  return (data ?? []) as Pipeline[];
}

/** Insert new prospects, leaving existing rows untouched (ignore duplicates). */
export async function upsertProspects(rows: Prospect[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from('prospects')
    .upsert(rows, { onConflict: 'place_id', ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

/** Save the pipeline state for one prospect. */
export async function savePipeline(row: Pipeline): Promise<void> {
  const { error } = await supabase
    .from('pipeline')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'place_id' });
  if (error) throw error;
}
