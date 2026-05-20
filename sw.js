// SweepAdmin Service Worker
// Caches the app shell so the UI loads instantly on minimize/maximize/revisit
// Dynamic data (Supabase) always fetches fresh from network

const CACHE_NAME = 'sweepadmin-v1';

// App shell files to cache (static assets only)
const SHELL_URLS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Exo+2:wght@300;400;500;600;700&display=swap',
];

// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can, ignore failures (CDN cors etc)
      return Promise.allSettled(SHELL_URLS.map(url => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Supabase API calls → always network (never cache dynamic data)
// - Google/accounts → network only
// - Everything else → cache-first, then network fallback
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Never cache Supabase API, auth, or Google Identity requests
  if (
    url.includes('supabase.co') ||
    url.includes('accounts.google.com') ||
    url.includes('googleapis.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For everything else: serve from cache, fetch in background to update
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          // Only cache successful GET responses
          if (response.ok && event.request.method === 'GET') {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached); // If network fails, return cached

        // Return cached immediately if available, else wait for network
        return cached || networkFetch;
      })
    )
  );
});
