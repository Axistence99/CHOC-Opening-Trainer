/* CHOC Opening Trainer — Service Worker
 *
 * Strategy: NETWORK-FIRST for same-origin requests, falling back to cache when
 * offline. This ensures users always get the latest deployed build (hashed JS
 * changes on every deploy), instead of being stuck on a stale cached version.
 * The app shell and Stockfish engine are still cached so the app works offline
 * after the first visit.
 */
const CACHE_VERSION = 'choc-v12-20260807-instant';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.ico',
  './favicon.png',
  './favicon-16.png',
  // Stockfish engine — allow offline engine play
  './engine/stockfish.wasm',
  './engine/stockfish.wasm.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}) // don't block install on an optional precache failure
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Cross-origin (e.g. Lichess piece CDN): cache-first, but let network win.
  if (!isSameOrigin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((res) => {
              if (res && res.ok) {
                const clone = res.clone();
                caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
              }
              return res;
            })
            .catch(() => cached)
      )
    );
    return;
  }

  // Same-origin: NETWORK-FIRST. Try the network; on failure fall back to cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache a successful copy for offline use.
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          // Navigation fallback to the app shell for offline SPA reloads.
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('./index.html');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
      )
  );
});
