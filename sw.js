// Service Worker - Coffee Roaster Pro
const CACHE_NAME = 'coffee-roaster-v4';
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

// Fetch - strategia "Network First" dla API, "Cache First" dla statycznych
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Obsługuj tylko GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // NIE cache'uj requestów do Supabase API - zawsze pobierz z sieci
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch((err) => {
          console.log('[SW] Błąd API:', err);
          return new Response(JSON.stringify({ error: 'Network error' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Dla statycznych plików - Network First (zawsze pobierz najnowsze)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Zaktualizuj cache
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Brak sieci - zwróć z cache
        return caches.match(request);
      })
  );
});

// Obsługa powiadomień push (opcjonalnie)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Coffee Roaster Pro', {
      body: data.body || 'Powiadomienie z aplikacji',
      icon: '/images/icon-192.svg',
      badge: '/images/icon-192.svg',
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
