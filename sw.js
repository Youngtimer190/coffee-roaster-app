// Service Worker - Coffee Roaster Pro
const CACHE_NAME = 'coffee-roaster-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json'
];

// Instalacja - cache statycznych zasobów
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cachowanie statycznych zasobów');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => {
        console.error('[SW] Błąd cachowania:', err);
      })
  );
  self.skipWaiting();
});

// Aktywacja - usuń stare cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Usuwanie starego cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch - strategia "Stale While Revalidate"
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Obsługuj tylko GET
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      // Zwróć z cache od razu (stale)
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Zaktualizuj cache (revalidate)
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.log('[SW] Błąd pobierania:', err);
          // Brak sieci - zwróć cache lub błąd
          return cached;
        });

      return cached || fetchPromise;
    })
  );
});

// Obsługa powiadomień push (opcjonalnie)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Coffee Roaster Pro', {
      body: data.body || 'Powiadomienie z aplikacji',
      icon: '/images/icon-192.png',
      badge: '/images/icon-96.png',
      tag: data.tag || 'general',
      requireInteraction: false
    })
  );
});

// Kliknięcie w powiadomienie
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
