// One-time migration: normalize pipeline.contract_expiry free text -> "YYYY-MM".
//
// Uses the Supabase SERVICE-ROLE key (admin), NOT the anon key. Supply it via env:
//   SUPABASE_SERVICE_ROLE_KEY=...  (NEXT_PUBLIC_SUPABASE_URL is read from .env.local)
//
// Dry run (default): prints what would change + the unparseable rows.
//   node --env-file=.env.local scripts/migrate-contract-expiry.mjs
// Apply:
//   SUPABASE_SERVICE_ROLE_KEY=xxx node --env-file=.env.local scripts/migrate-contract-expiry.mjs --apply
//
// Parser is kept in sync with lib/contracts.ts (ambiguous two-digit/two-digit
// pairs like "03-09" and bare years are rejected — never guessed).

import { createClient } from '@supabase/supabase-js';

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function ym(year, month) {
  if (month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseExpiry(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return ym(Number(m[1]), Number(m[2]));
  m = s.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) return ym(Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})[/-](\d{1,2})$/);
  if (m) return ym(Number(m[1]), Number(m[2]));
  const year = s.match(/\b(\d{4})\b/);
  if (year) {
    for (const tok of s.toLowerCase().match(/[a-zéû]+/g) ?? []) {
      if (MONTHS[tok]) return ym(Number(year[1]), MONTHS[tok]);
    }
  }
  return null;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: pipeline, error: e1 } = await supabase
  .from('pipeline')
  .select('place_id, contract_expiry');
if (e1) throw e1;
const { data: prospects } = await supabase.from('prospects').select('place_id, name');
const nameOf = Object.fromEntries((prospects ?? []).map((p) => [p.place_id, p.name]));

let normalized = 0;
let unchanged = 0;
const unparseable = [];

for (const row of pipeline ?? []) {
  const raw = row.contract_expiry;
  if (!raw || !String(raw).trim()) continue;
  const parsed = parseExpiry(raw);
  if (!parsed) {
    unparseable.push({ place_id: row.place_id, name: nameOf[row.place_id] ?? '?', raw });
    continue;
  }
  if (parsed === raw) {
    unchanged += 1;
    continue;
  }
  normalized += 1;
  if (apply) {
    const { error } = await supabase
      .from('pipeline')
      .update({ contract_expiry: parsed, updated_at: new Date().toISOString() })
      .eq('place_id', row.place_id);
    if (error) console.error(`  ! failed ${row.place_id}: ${error.message}`);
  } else {
    console.log(`  would set "${raw}" -> ${parsed}  (${nameOf[row.place_id] ?? '?'})`);
  }
}

console.log(`\n${apply ? 'APPLIED' : 'DRY RUN'}: normalized ${normalized}, unchanged ${unchanged}, unparseable ${unparseable.length}`);
if (unparseable.length) {
  console.log('\nUnparseable (left as-is, flagged "fix date" in the app):');
  for (const u of unparseable) console.log(`  - ${u.name}: "${u.raw}"  [${u.place_id}]`);
}
if (!apply) console.log('\nRe-run with --apply to write changes.');
