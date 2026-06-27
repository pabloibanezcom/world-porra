const CACHE_VERSION = 'world-porra-v4';
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
    )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) =>
        Promise.all(
          clients.map((client) => {
            if ('navigate' in client && client.url) {
              return client.navigate(client.url);
            }
            return undefined;
          })
        )
      )
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'World Porra', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
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

  // Navigation requests (HTML) — refresh the app shell first, fall back offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response.ok) cache.put('/index.html', response.clone());
            return response;
          })
          .catch(() => cache.match('/index.html'))
      )
    );
    return;
  }

  // App bundles must update on the first reload after a deploy.
  if (request.destination === 'script') {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cache.match(request))
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
        }).catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
