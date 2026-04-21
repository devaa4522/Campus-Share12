// public/sw.js
// CampusShare Service Worker — Push Notifications + Offline Cache

const CACHE_NAME = 'campusshare-v1';
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API calls
  if (request.method !== 'GET' || url.hostname.includes('supabase')) return;

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
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'CampusShare', body: event.data.text(), type: 'system' };
  }

  const { title, body, type, data = {} } = payload;

  const iconMap = {
    new_request:      '/favicon-192x192.png',
    request_accepted: '/favicon-192x192.png',
    request_rejected: '/favicon-192x192.png',
    qr_handshake:     '/favicon-192x192.png',
    deal_completed:   '/favicon-192x192.png',
    new_message:      '/favicon-192x192.png',
    task_claimed:     '/favicon-192x192.png',
    karma_received:   '/favicon-192x192.png',
    karma_penalty:    '/favicon-192x192.png',
    system:           '/android-chrome-192x192.png',
  };

  const actionMap = {
    new_request:      [{ action: 'view_deal', title: '📦 View Request' }],
    request_accepted: [{ action: 'scan_qr',   title: '🤝 Scan QR' }],
    new_message:      [{ action: 'open_chat', title: '💬 Reply' }],
    task_claimed:     [{ action: 'view_task', title: '⚡ View Task' }],
    deal_completed:   [{ action: 'view_karma', title: '🏆 See Karma' }],
  };

  const options = {
    body,
    icon: iconMap[type] || '/android-chrome-192x192.png',
    tag: `${type}-${data.deal_id || data.conversation_id || data.task_id || Date.now()}`,
    renotify: true,
    data: { url: getDeepLink(type, data), type, ...data },
    actions: actionMap[type] || [],
    vibrate: getVibrationPattern(type),
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: deep-link routing ───────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || '/';

  if (action === 'scan_qr')    targetUrl = `/dashboard?scan=true&deal=${notifData.deal_id}`;
  if (action === 'open_chat')  targetUrl = `/messages?conv=${notifData.conversation_id}`;
  if (action === 'view_deal')  targetUrl = `/dashboard?deal=${notifData.deal_id}`;
  if (action === 'view_task')  targetUrl = `/tasks?task=${notifData.task_id}`;
  if (action === 'view_karma') targetUrl = `/profile`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Notification close tracking ─────────────────────────────
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ── Helpers ──────────────────────────────────────────────────
function getDeepLink(type, data) {
  const routes = {
    new_request:      `/dashboard?deal=${data.deal_id}`,
    request_accepted: `/dashboard?deal=${data.deal_id}&scan=true`,
    request_rejected: `/hub`,
    qr_handshake:     `/dashboard?deal=${data.deal_id}`,
    deal_completed:   `/profile`,
    new_message:      `/messages?conv=${data.conversation_id}`,
    task_claimed:     `/tasks?task=${data.task_id}`,
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
