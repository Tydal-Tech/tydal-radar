// Tydal Radar backup / restore.
//
// The DB is reachable with the public anon key (RLS is permissive), so a stray
// or malicious request could wipe the prospects + pipeline. This snapshots both
// tables to a dated JSON OUTSIDE the DB (a backup living in the same DB wouldn't
// survive a wipe), so a wipe becomes an "undo".
//
// Backup:   node --env-file=.env.local scripts/backup.mjs
// Restore:  node --env-file=.env.local scripts/backup.mjs --restore backups/<file>.json
//
// Key: prefers SUPABASE_SERVICE_ROLE_KEY, falls back to the anon key (which the
// permissive RLS already allows to read + upsert). Restore upserts by place_id
// (prospects first — pipeline has an FK), overwriting existing rows.

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key.');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const PAGE = 1000;

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('place_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function upsertAll(table, rows) {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'place_id' });
    if (error) throw error;
  }
}

const restoreIdx = process.argv.indexOf('--restore');

if (restoreIdx !== -1) {
  const file = process.argv[restoreIdx + 1];
  if (!file) {
    console.error('Usage: node --env-file=.env.local scripts/backup.mjs --restore <backup.json>');
    process.exit(1);
  }
  const snap = JSON.parse(await readFile(file, 'utf8'));
  const prospects = snap.prospects ?? [];
  const pipeline = snap.pipeline ?? [];
  console.log(`Restoring ${file} (snapshot ${snap.created_at}) — overwrites rows by place_id...`);
  await upsertAll('prospects', prospects); // prospects first: pipeline references them
  await upsertAll('pipeline', pipeline);
  console.log(`Restored ${prospects.length} prospects, ${pipeline.length} pipeline rows.`);
} else {
  const [prospects, pipeline] = await Promise.all([fetchAll('prospects'), fetchAll('pipeline')]);
  const created_at = new Date().toISOString();
  const snap = { created_at, counts: { prospects: prospects.length, pipeline: pipeline.length }, prospects, pipeline };
  await mkdir('backups', { recursive: true });
  const path = join('backups', `tydal-${created_at.replace(/[:.]/g, '-')}.json`);
  await writeFile(path, JSON.stringify(snap));
  console.log(`Backed up ${prospects.length} prospects + ${pipeline.length} pipeline rows -> ${path}`);
}
