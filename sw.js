// GameBill SW v3 — adapted from original, now at root path
const CACHE = 'gamebill-v3';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      './',
      './index.html'
    ])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Never intercept Supabase API or external CDN calls
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) {
        const c = r.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, c)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match(e.request).then(cached => cached || fetch(e.request)))
  );
});
