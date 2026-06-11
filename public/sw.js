// Tydal Radar service worker — modest, hand-written (no build tooling).
// Caches same-origin static assets (cache-first) and app navigations
// (network-first with cache fallback). Cross-origin requests (Google Maps
// tiles, Supabase) are never intercepted, so they always go straight to the
// network.

const CACHE = 'tydal-radar-v2';
const STATIC_PATTERNS = [/\/_next\/static\//, /\/icons\//, /\/manifest\.webmanifest$/];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Google/Supabase alone

  if (STATIC_PATTERNS.some((re) => re.test(url.pathname))) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}
