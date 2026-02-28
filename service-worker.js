// ─────────────────────────────────────────────
// Service Worker — Battery Run Time Calculator
// Cache version: increment this with every deployment
// ─────────────────────────────────────────────
const CACHE_NAME = 'batt-calc-v37';

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
// Strategy: network-first for all assets.
//   1. Always try the network first (user always gets latest files)
//   2. On network success, update the cache for offline use
//   3. If the network fails, fall back to the cached version
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, networkResponse.clone())
          );
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))  // offline fallback
  );
});
