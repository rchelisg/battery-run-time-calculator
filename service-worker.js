// ─────────────────────────────────────────────
// Service Worker — Battery Run Time Calculator
// Cache version: increment this with every deployment
// ─────────────────────────────────────────────
const CACHE_NAME = 'batt-calc-v20';

// All assets to pre-cache on first install
// Use relative paths (./…) so this works on GitHub Pages subdirectories
// e.g. https://rchelisg.github.io/battery-run-time-calculator/
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json',
  './icons/icon.png'
];

// ── Install ──────────────────────────────────
// Pre-cache all assets so the app works offline immediately
self.addEventListener('install', event => {
  console.log('[SW] Installing v18…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Skip waiting so this SW activates immediately (don't wait for old SW to die)
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────
// Remove any old caches from previous versions, then take control right away
self.addEventListener('activate', event => {
  console.log('[SW] Activating v18…');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)   // only delete OLD caches
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all open tabs immediately without waiting for a reload
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────
// Strategy: stale-while-revalidate
//   1. Respond immediately with cached version (fast)
//   2. Fetch fresh copy from network in the background and update the cache
//   3. If nothing is cached yet, wait for the network response
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {

        // Always fetch a fresh copy in the background to keep cache current
        const networkFetch = fetch(event.request)
          .then(networkResponse => {
            // Only cache successful same-origin responses
            if (networkResponse && networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed — that's OK, we have the cache
            return null;
          });

        // Return cached response right away; fall back to network if not cached
        return cachedResponse || networkFetch;
      });
    })
  );
});
