const CACHE_VERSION = 'wc2026-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;

const ALL_CACHES = [STATIC_CACHE, FONT_CACHE];

// On install, activate immediately without waiting for existing clients to close
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE));
});

// On activate, delete stale caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls — always go to the network
  if (url.pathname.startsWith('/auth') ||
      url.pathname.startsWith('/matches') ||
      url.pathname.startsWith('/predictions') ||
      url.pathname.startsWith('/leagues') ||
      url.hostname !== self.location.hostname) {
    event.respondWith(fetch(request));
    return;
  }

  // Fonts — cache forever once fetched
  if (request.destination === 'font' || url.pathname.includes('/fonts/')) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Navigation requests (HTML) — serve app shell, fall back to network
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) =>
        cached || fetch(request)
      )
    );
    return;
  }

  // Static assets (JS, CSS, images) — stale-while-revalidate
  event.respondWith(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
        return cached || networkFetch;
      })
    )
  );
});
