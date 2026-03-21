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

  // Stale-While-Revalidate for application HTML / data queries (except POST/API)
  if (event.request.method === 'GET' && !url.pathname.startsWith('/api/') && !url.origin.includes('supabase.co')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        }).catch(() => {});
        
        return cachedResponse || fetchPromise;
      })
    );
  }
});
