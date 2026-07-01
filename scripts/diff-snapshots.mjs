// Diff two snapshots to show market change: businesses that appeared (growth)
// and disappeared (churn / closed) between two dates. Mirrors lib/snapshot-diff.ts
// (kept in sync; that one is unit-tested).
//
//   node scripts/diff-snapshots.mjs                 # newest two in market-snapshots/
//   node scripts/diff-snapshots.mjs old.json new.json
//
// With no args it diffs the two newest market-snapshots/ (the scraper's per-run
// found set, which reveals openings AND closures). To diff anything else — e.g.
// two DB backups — pass the two file paths explicitly.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function jsonsIn(dir) {
  return (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json')).sort();
}

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
  const files = await jsonsIn('market-snapshots');
  if (files.length < 2) {
    console.error(
      `Only ${files.length} market snapshot(s) yet — a change report needs two. ` +
        'One is written each time radar-grid-scrape.js runs, so the report begins after the next scrape. ' +
        '(To diff specific files instead: node scripts/diff-snapshots.mjs <old.json> <new.json>.)',
    );
    process.exit(1);
  }
  a = join('market-snapshots', files.at(-2));
  b = join('market-snapshots', files.at(-1));
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
