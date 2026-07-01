// Diff two backup snapshots (scripts/backup.mjs output) to show market change:
// businesses that appeared (growth) and disappeared (churn / closed) between two
// dates. Mirrors lib/snapshot-diff.ts (kept in sync; that one is unit-tested).
//
//   node scripts/diff-snapshots.mjs                 # newest two in backups/
//   node scripts/diff-snapshots.mjs old.json new.json

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

function countByType(rows) {
  const m = {};
  for (const r of rows) {
    const t = r.type ?? 'unknown';
    m[t] = (m[t] ?? 0) + 1;
  }
  return m;
}

let [, , a, b] = process.argv;
if (!a || !b) {
  const files = (await readdir('backups').catch(() => []))
    .filter((f) => f.endsWith('.json'))
    .sort(); // ISO-timestamp names sort chronologically
  if (files.length < 2) {
    console.error('Need two snapshots in backups/ — run scripts/backup.mjs on two different dates.');
    process.exit(1);
  }
  a = join('backups', files.at(-2));
  b = join('backups', files.at(-1));
}

const older = JSON.parse(await readFile(a, 'utf8')).prospects ?? [];
const newer = JSON.parse(await readFile(b, 'utf8')).prospects ?? [];
const oldIds = new Set(older.map((p) => p.place_id));
const newIds = new Set(newer.map((p) => p.place_id));
const added = newer.filter((p) => !oldIds.has(p.place_id));
const removed = older.filter((p) => !newIds.has(p.place_id));

console.log(`${a} (${older.length})  ->  ${b} (${newer.length})`);
console.log(`+${added.length} new  ·  -${removed.length} gone`);
console.log('new by type: ', countByType(added));
console.log('gone by type:', countByType(removed));

if (added.length) {
  console.log('\nNew:');
  for (const p of added.slice(0, 20)) console.log(`  + ${p.name}  [${p.type}]  ${p.neighborhood ?? ''}`);
}
if (removed.length) {
  console.log('\nGone:');
  for (const p of removed.slice(0, 20)) console.log(`  - ${p.name}  [${p.type}]  ${p.neighborhood ?? ''}`);
}
