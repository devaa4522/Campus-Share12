// public/sw.js
// CampusShare Service Worker — Push Notifications + Offline Cache

const CACHE_NAME = 'campusshare-v2';
const OFFLINE_URLS = ['/', '/hub', '/tasks', '/messages', '/dashboard'];

// ── Install: cache shell pages ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, non-HTTP schemas, and Supabase API calls
  if (
    request.method !== 'GET' || 
    !request.url.startsWith('http') || 
    url.hostname.includes('supabase')
  ) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push: show notification ──────────────────────────────────
self.addEventListener('push', function (event) {
  if (event.data) {
    let data;
    try {
      data = event.data.json();
    } catch {
      data = { title: 'CampusShare', body: event.data.text(), type: 'system' };
    }

    const options = {
      body: data.body,
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      vibrate: getVibrationPattern(data.type),
      data: { 
        ...data.data, 
        url: data.data?.url || getDeepLink(data.type, data.data) 
      },
      actions: data.actions || [],
      tag: data.type === 'new_message' ? `msg-${data.data?.conversation_id}` : undefined,
      renotify: data.type === 'new_message',
    };
    
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Handle the quick-action button clicks (e.g., "Accept Deal")
  if (event.action === 'accept') {
    // Silently call your API without opening the app window
    event.waitUntil(
      fetch('/api/accept-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: event.notification.data.deal_id })
      })
    );
    return;
  }

  // Default tap behavior: Open the app to the specific route
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // If app is already open, focus it and navigate
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.indexOf(self.registration.scope) !== -1 && 'focus' in client) {
            client.navigate(event.notification.data.url);
            return client.focus();
          }
        }
        // If app is closed, open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});

// ── Notification close tracking ─────────────────────────────
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ── Helpers ──────────────────────────────────────────────────
function getDeepLink(type, data) {
  const safeData = data || {};
  const routes = {
    new_request:      `/dashboard?deal=${safeData.deal_id}`,
    request_accepted: `/dashboard?deal=${safeData.deal_id}&scan=true`,
    request_rejected: `/hub`,
    qr_handshake:     `/dashboard?deal=${safeData.deal_id}`,
    deal_completed:   `/profile`,
    new_message:      `/messages?conv=${safeData.conversation_id}`,
    task_claimed:     `/tasks?task=${safeData.task_id}`,
    task_completed:   `/profile`,
    karma_received:   `/profile`,
    karma_penalty:    `/profile`,
    system:           `/`,
  };
  return routes[type] || '/';
}

function getVibrationPattern(type) {
  const patterns = {
    new_request:      [100, 50, 100],           // Double tap
    request_accepted: [200, 100, 200, 100, 400], // Success heartbeat
    request_rejected: [500],                     // Single long
    new_message:      [50, 50, 50],              // Triple short
    deal_completed:   [100, 50, 100, 50, 300],  // Victory
    karma_received:   [100, 100, 200],           // Rising
    karma_penalty:    [300, 100, 300],           // Warning pulse
    task_claimed:     [150, 50, 150],            // Double medium
  };
  return patterns[type] || [100];
}