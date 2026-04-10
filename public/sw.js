const CACHE_NAME = 'campus-share-v1';
const FONT_CACHE = 'campus-share-fonts-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => 
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name !== FONT_CACHE) {
            return caches.delete(name);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache-First for static fonts/css from Google
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => 
        cachedResponse || fetch(event.request).then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(FONT_CACHE).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
      )
    );
    return;
  }

  // Network-First Fallback-to-Cache for Supabase Queries
  if (event.request.method === 'GET' && url.origin.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open('campus-share-supabase-v1').then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Stale-While-Revalidate for application HTML / data queries (except POST/API/Internal)
  const isNextInternal = url.pathname.startsWith('/_next/') || url.pathname.includes('hmr');
  
  if (event.request.method === 'GET' && !url.pathname.startsWith('/api/') && !isNextInternal) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          const responseClone = networkResponse.clone();
          if (event.request.url.startsWith('http')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => {});
        
        return cachedResponse || fetchPromise;
      })
    );
  }
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/android-chrome-192x192.png', 
      badge: '/favicon-32x32.png',
      data: data.url || '/'
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data) {
    event.waitUntil(
      clients.openWindow(event.notification.data)
    );
  }
});

// Auth Transition Cache Invalidation
// When the client signals a logout, purge all app caches to prevent
// stale Turbopack chunks from poisoning the next session's RSC stream.
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(name) {
            return caches.delete(name);
          })
        );
      })
    );
  }
});
