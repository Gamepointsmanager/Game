// GameBill Service Worker — v2
// Strategy: serve from cache instantly, update in background
// Result: zero reload on minimize/tab switch, always fresh data

const CACHE = 'gamebill-v2';
const SHELL = ['./index.html', './'];

// ── Install: pre-cache app shell ─────────────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
});

// ── Activate: remove old caches ──────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate ────────────────────────────────────────────
// Serve cached version immediately (no reload), fetch fresh in background
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Skip cross-origin requests (Supabase API, CDN scripts)
  // — let those go straight to network, never cache them
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Navigation: return cached shell instantly, revalidate in background
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match('./index.html');
        const fetchPromise = fetch(req).then(res => {
          if (res.ok) cache.put('./index.html', res.clone());
          return res;
        }).catch(() => null);
        // Return cached immediately if available, else wait for network
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static assets: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || fetchPromise;
    })
  );
});
