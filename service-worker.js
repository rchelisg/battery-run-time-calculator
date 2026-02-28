// ─────────────────────────────────────────────
// Service Worker — Battery Run Time Calculator
// Cache version: increment this with every deployment
// ─────────────────────────────────────────────
const CACHE_NAME = 'batt-calc-v35';

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
// Strategy:
//   HTML (index.html / root)  → network-first, fall back to cache
//   All other assets (JS/CSS) → cache-first, fall back to network
// Network-first for HTML ensures users always get the latest markup.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isHtml = url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHtml) {
    // Network-first: always try to get fresh HTML
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
  } else {
    // Cache-first for JS, CSS, images, etc.
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cachedResponse => {
          const networkFetch = fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => null);
          return cachedResponse || networkFetch;
        })
      )
    );
  }
});
