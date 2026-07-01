// Radar grid scraper — citywide Montreal prospect pull.
//
// Why this exists: the in-app "Refresh" (lib/places.ts) runs one Places query
// per (type x neighborhood) bounded by 4 neighborhood boxes. Google Places caps
// any single Text Search at 60 results (3 pages of 20), so a citywide pull
// flat-lines around ~270. This script tiles Montreal into a grid of small cells
// and runs every ICP category in each cell, so no single search is anywhere near
// the 60 cap. Results are deduped by place_id across the whole run and inserted
// into the `prospects` table (matching lib/db.ts: ignore duplicates, never
// clobber existing rows).
//
// Run:
//   node --env-file=.env.local radar-grid-scrape.js          # scrape + upsert
//   node --env-file=.env.local radar-grid-scrape.js --dry-run # scrape, no write
//
// Keys (reused from .env.local): NEXT_PUBLIC_GOOGLE_MAPS_KEY (Places API New),
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (RLS is permissive for
// anon). The Maps key is HTTP-referrer-restricted to the app's domains, so we
// send a matching Referer header on every Places call.

const { createClient } = require('@supabase/supabase-js');

// ---- config ---------------------------------------------------------------

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// The Maps key is locked to these referrers (see README "Deploy"); Node sends no
// referer by default, which the key rejects. Mirror an allowed one.
const REFERER = 'http://localhost:3000/';

const DRY_RUN = process.argv.includes('--dry-run');

// Optional: limit the run to specific buckets, e.g. `--only=medical` or
// `--only=office,medical`. Lets you scrape one category citywide without
// re-burning Places quota on the others. No flag = every search.
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean))
  : null;

// Search specs — one Places Text Search each, tagged with the `type` bucket it
// writes to. Queries mirror lib/icp.ts. `office` is deliberately SEVERAL searches
// (lawyer / accounting / real estate) merged into ONE bucket — no subtypes.
// `medical` (clinics/doctors) is its own bucket, listed BEFORE office so a place
// matching both is deduped as medical (global place_id dedup, first search wins).
const SEARCHES = [
  { type: 'daycare',    query: 'garderie CPE daycare',                  includedType: 'child_care_agency' },
  { type: 'dental',     query: 'dental clinic dentist',                 includedType: 'dentist' },
  { type: 'gym',        query: 'gym fitness studio',                    includedType: 'gym' },
  { type: 'veterinary', query: 'veterinary clinic vet animal hospital', includedType: 'veterinary_care' },
  { type: 'medical',    query: 'medical clinic doctor walk-in',         includedType: 'doctor' },
  // office bucket — professional offices, all merged under type 'office':
  { type: 'office',     query: 'law firm lawyer attorney',              includedType: 'lawyer' },
  { type: 'office',     query: 'accounting firm accountant CPA',        includedType: 'accounting' },
  { type: 'office',     query: 'real estate agency realtor broker',     includedType: 'real_estate_agency' },
];

// Never an ICP match — dropped post-search (mirrors lib/icp.ts TYPE_DENYLIST).
const TYPE_DENYLIST = new Set([
  'supermarket', 'grocery_store', 'department_store', 'shopping_mall',
  'gas_station', 'car_dealer', 'car_repair', 'bank', 'atm', 'hospital',
  'university', 'lodging', 'hotel', 'tourist_attraction', 'park', 'church',
  'place_of_worship',
]);

// Named neighborhood boxes from lib/icp.ts — used to label prospects that fall
// inside one. Everything else on the island gets the catch-all 'Montréal'.
const NAMED = [
  { name: 'Ville-Marie',          s: 45.494, w: -73.578, n: 45.516, e: -73.548 },
  { name: 'Shaughnessy Village',  s: 45.489, w: -73.587, n: 45.501, e: -73.571 },
  { name: 'Plateau-Mont-Royal',   s: 45.512, w: -73.598, n: 45.537, e: -73.564 },
  { name: 'Côte-des-Neiges–NDG',  s: 45.458, w: -73.642, n: 45.502, e: -73.598 },
];

// Grid over the developed island of Montreal. Cells are ~2.2-2.5 km so a single
// (cell x search) effectively never reaches the 60-result cap.
const GRID = { south: 45.41, north: 45.69, west: -73.97, east: -73.48 };
const LAT_STEP = 0.022; // ~2.45 km
const LNG_STEP = 0.028; // ~2.18 km at 45.5 deg lat

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.types',
  'places.businessStatus',
  'nextPageToken',
].join(',');

// ---- helpers --------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function neighborhoodFor(lat, lng) {
  for (const z of NAMED) {
    if (lat >= z.s && lat <= z.n && lng >= z.w && lng <= z.e) return z.name;
  }
  return 'Montréal';
}

function buildCells() {
  const cells = [];
  for (let s = GRID.south; s < GRID.north; s += LAT_STEP) {
    for (let w = GRID.west; w < GRID.east; w += LNG_STEP) {
      cells.push({
        low:  { latitude: s, longitude: w },
        high: { latitude: Math.min(s + LAT_STEP, GRID.north), longitude: Math.min(w + LNG_STEP, GRID.east) },
      });
    }
  }
  return cells;
}

// One Text Search, following nextPageToken up to the 60-result Places ceiling.
async function searchCell(spec, rectangle) {
  const collected = [];
  let pageToken;
  for (let page = 0; page < 3; page++) {
    const body = {
      textQuery: spec.query,
      includedType: spec.includedType,
      maxResultCount: 20,
      languageCode: 'en',
      regionCode: 'CA',
      locationRestriction: { rectangle },
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
        Referer: REFERER,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    for (const p of json.places ?? []) collected.push(p);

    pageToken = json.nextPageToken;
    if (!pageToken) break;
    await sleep(150); // gentle pacing between pages
  }
  return collected;
}

function toProspect(p, type) {
  if (!p.id || !p.location || !p.displayName?.text) return null;
  if ((p.types ?? []).some((t) => TYPE_DENYLIST.has(t))) return null;
  // Skip closed businesses (keep unknown-status places).
  if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') return null;
  const lat = p.location.latitude;
  const lng = p.location.longitude;
  return {
    place_id: p.id,
    name: p.displayName.text,
    type,
    neighborhood: neighborhoodFor(lat, lng),
    lat,
    lng,
    phone: p.nationalPhoneNumber ?? null,
    address: p.formattedAddress ?? null,
  };
}

// ---- main -----------------------------------------------------------------

async function main() {
  if (!MAPS_KEY) { console.error('Missing NEXT_PUBLIC_GOOGLE_MAPS_KEY'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase URL/key'); process.exit(1); }

  const cells = buildCells();
  const activeSearches = ONLY ? SEARCHES.filter((s) => ONLY.has(s.type)) : SEARCHES;
  if (activeSearches.length === 0) {
    console.error(`--only matched no buckets. Known: ${[...new Set(SEARCHES.map((s) => s.type))].join(', ')}`);
    process.exit(1);
  }
  const bucketTypes = [...new Set(activeSearches.map((s) => s.type))];
  console.log(
    `Grid: ${cells.length} cells x ${activeSearches.length} searches/cell = ${cells.length * activeSearches.length} searches` +
    ` (${bucketTypes.length} categor${bucketTypes.length === 1 ? 'y' : 'ies'}${ONLY ? `: ${bucketTypes.join(', ')}` : ''})` +
    `${DRY_RUN ? '  (DRY RUN — no write)' : ''}`,
  );

  const byId = new Map();        // place_id -> prospect (global dedup)
  const perType = Object.fromEntries(bucketTypes.map((t) => [t, 0]));
  const errors = [];
  let searches = 0;
  let truncatedCells = 0;        // (cell,search) pairs that hit the 60 cap

  for (let i = 0; i < cells.length; i++) {
    const rectangle = cells[i];
    for (const spec of activeSearches) {
      try {
        const places = await searchCell(spec, rectangle);
        searches++;
        if (places.length >= 60) truncatedCells++;
        for (const p of places) {
          const prospect = toProspect(p, spec.type);
          if (prospect && !byId.has(prospect.place_id)) {
            byId.set(prospect.place_id, prospect);
            perType[spec.type]++;
          }
        }
      } catch (e) {
        errors.push(`cell ${i} / ${spec.type} (${spec.includedType}): ${e.message}`);
      }
    }
    if ((i + 1) % 20 === 0 || i === cells.length - 1) {
      console.log(`  cells ${i + 1}/${cells.length} · searches ${searches} · unique so far ${byId.size}`);
    }
  }

  const prospects = [...byId.values()];
  console.log(`\nUnique prospects found: ${prospects.length}`);
  console.log('By category:', perType);
  if (truncatedCells) console.log(`Note: ${truncatedCells} (cell x search) pairs hit the 60 cap — consider a finer grid there.`);
  if (errors.length) {
    console.log(`\n${errors.length} errors (first 10):`);
    for (const e of errors.slice(0, 10)) console.log('  ! ' + e);
  }

  if (DRY_RUN) { console.log('\nDRY RUN — nothing written.'); return; }

  // Upsert in batches, ignoring duplicates (matches lib/db.ts upsertProspects).
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { count: before } = await supabase.from('prospects').select('*', { count: 'exact', head: true });

  const BATCH = 500;
  for (let i = 0; i < prospects.length; i += BATCH) {
    const chunk = prospects.slice(i, i + BATCH);
    const { error } = await supabase
      .from('prospects')
      .upsert(chunk, { onConflict: 'place_id', ignoreDuplicates: true });
    if (error) { console.error(`Upsert batch ${i / BATCH} failed: ${error.message}`); process.exit(1); }
  }

  const { count: after } = await supabase.from('prospects').select('*', { count: 'exact', head: true });
  console.log(`\nprospects table: ${before ?? '?'} -> ${after ?? '?'} rows (+${(after ?? 0) - (before ?? 0)} new).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
