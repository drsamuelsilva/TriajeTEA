const CACHE_NAME = 'neuroscreen-v1';

self.addEventListener('install', (e) => {
  // Forzar activación inmediata
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Estrategia Cache-First con actualización en segundo plano
self.addEventListener('fetch', (e) => {
  // Evitar interceptar solicitudes a APIs externas o de tipo POST
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Silenciar fallos de red offline
      });

      return cachedResponse || fetchPromise;
    })
  );
});
