// GameBill SW v3 — stale-while-revalidate, no reload on minimize
const CACHE = 'gamebill-v3';
const SHELL = ['./'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache cross-origin (Supabase API, CDN) — always network
  if (url.origin !== self.location.origin) return;

  // For page navigation — serve cached HTML instantly, update in background
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('./');
      // Update cache in background without blocking
      fetch(req).then(res => {
        if (res && res.ok) cache.put('./', res.clone());
      }).catch(()=>{});
      // Return cached immediately — zero reload, zero flash
      return cached || fetch(req);
    })());
    return;
  }

  // For JS/CSS/font assets — cache first, background update
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(()=>cached);
    return cached || fetchPromise;
  })());
});
