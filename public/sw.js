// public/sw.js
// CampusShare Service Worker — Push Notifications + Offline Cache
// Handles encrypted Web Push (aesgcm), actionable notifications, and deep linking.

const CACHE_NAME = 'campusshare-v3';
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

// ── Messages from app: cache maintenance ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CLEAR_CACHE') return;

  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  );
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
  console.log('[SW] Push received');

  if (!event.data) {
    console.warn('[SW] Push event has no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.warn('[SW] Failed to parse push JSON, using text fallback:', e);
    data = {
      title: 'CampusShare',
      body: event.data.text(),
      type: 'system',
      data: {},
    };
  }

  console.log('[SW] Push data:', JSON.stringify(data));

  const title = data.title || 'CampusShare';
  const url = data.data?.url || getDeepLink(data.type, data.data);

  // Build notification options like WhatsApp/Telegram
  const options = {
    body: data.body || '',
    icon: data.icon || '/android-chrome-192x192.png',  // ⭐ Use sender avatar from payload
    badge: data.badge || '/favicon-32x32.png',
    image: data.image,  // ⭐ Large image for Android expanded view
    vibrate: getVibrationPattern(data.type),
    data: {
      ...(data.data || {}),
      url: url,
      type: data.type,
      timestamp: data.data?.timestamp || Date.now(),  // ⭐ Use server timestamp
    },
    actions: getActions(data.type, data.data),
    tag: getTag(data.type, data.data),
    renotify: data.type === 'new_message',
    requireInteraction: isHighPriority(data.type),
    timestamp: data.data?.timestamp || Date.now(),  // ⭐ Use server timestamp
    dir: 'auto',  // ⭐ RTL language support
    silent: data.type === 'system',  // ⭐ Mute system notifications
  };

  event.waitUntil(self.registration.showNotification(title, options));
});


// ── Notification click: deep link into app ───────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || '/';

  // Handle action button clicks
  if (event.action === 'reply') {
    targetUrl = notifData.url || '/messages';
  } else if (event.action === 'view_deal') {
    targetUrl = getDeepLink(notifData.type, notifData);
  } else if (event.action === 'view_profile') {
    targetUrl = '/profile';
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open, navigate and focus
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If the app is closed, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Notification close tracking ─────────────────────────────
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ── Helpers ──────────────────────────────────────────────────

function firstPresent() {
  for (const value of arguments) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function idFrom(data) {
  const keys = Array.prototype.slice.call(arguments, 1);
  for (const key of keys) {
    const value = data?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
  }
  return '';
}

function withParam(path, key, value) {
  if (value === null || value === undefined || value === '') return path;
  const separator = path.includes('?') ? '&' : '?';
  return path + separator + key + '=' + encodeURIComponent(String(value));
}

function dashboardDealLink(dealId, type, scan) {
  let path = withParam('/dashboard', 'deal', dealId);
  if (type) path = withParam(path, 'type', type);
  if (scan) path = withParam(path, 'scan', 'true');
  return path;
}

function getDeepLink(type, data) {
  const d = data || {};
  const explicitUrl = firstPresent(d.url, d.href, d.link);
  if (explicitUrl && explicitUrl.startsWith('/')) return explicitUrl;

  const conversationId = idFrom(d, 'conversation_id', 'conv_id', 'conversationId');
  const itemDealId = idFrom(d, 'deal_id', 'item_request_id', 'request_id', 'itemRequestId');
  const taskId = idFrom(d, 'task_id', 'deal_id', 'taskId');

  switch (type) {
    case 'new_request':
      return dashboardDealLink(itemDealId, 'item');
    case 'request_accepted':
      return dashboardDealLink(itemDealId, 'item', true);
    case 'request_rejected':
      return itemDealId ? dashboardDealLink(itemDealId, 'item') : '/hub';
    case 'qr_handshake':
    case 'item_returned':
      return dashboardDealLink(itemDealId, 'item');
    case 'deal_completed':
      return itemDealId ? dashboardDealLink(itemDealId, 'item') : '/profile';
    case 'new_message':
      return withParam('/messages', 'id', conversationId);
    case 'task_claimed':
    case 'task_completed':
      return dashboardDealLink(taskId, 'task');
    case 'karma_received':
    case 'karma_penalty':
      return '/profile';
    case 'system':
    default:
      return '/';
  }
}

function getVibrationPattern(type) {
  const patterns = {
    new_request:      [100, 50, 100],           // Double tap
    request_accepted: [200, 100, 200, 100, 400], // Success heartbeat
    request_rejected: [500],                     // Single long
    new_message:      [50, 50, 50],              // Triple short (like WhatsApp)
    deal_completed:   [100, 50, 100, 50, 300],  // Victory
    karma_received:   [100, 100, 200],           // Rising
    karma_penalty:    [300, 100, 300],           // Warning pulse
    task_claimed:     [150, 50, 150],            // Double medium
    qr_handshake:     [200, 100, 200],           // Handshake
  };
  return patterns[type] || [100];
}

// WhatsApp/Telegram-style contextual action buttons
function getActions(type, data) {
  switch (type) {
    case 'new_request':
      return [
        { action: 'view_deal', title: '👀 View Request', icon: '/favicon-32x32.png' },
        { action: 'dismiss', title: '✕ Dismiss', icon: '/favicon-32x32.png' },
      ];
    case 'request_accepted':
      return [
        { action: 'view_deal', title: '🤝 Start Handshake', icon: '/favicon-32x32.png' },
      ];
    case 'new_message':
      return [
        { action: 'reply', title: '💬 Open Chat', icon: '/favicon-32x32.png' },
        { action: 'dismiss', title: '✕ Dismiss', icon: '/favicon-32x32.png' },
      ];
    case 'karma_received':
    case 'deal_completed':
      return [
        { action: 'view_profile', title: '⭐ View Profile', icon: '/favicon-32x32.png' },
      ];
    default:
      return [];
  }
}

// Group related notifications by tag (like WhatsApp groups by chat)
function getTag(type, data) {
  const d = data || {};
  switch (type) {
    case 'new_message':
      return `msg-${d.conversation_id || 'unknown'}`;
    case 'new_request':
    case 'request_accepted':
    case 'request_rejected':
    case 'qr_handshake':
      return `deal-${d.deal_id || 'unknown'}`;
    default:
      return `cs-${type}-${Date.now()}`;
  }
}

// High-priority notifications stay visible until dismissed
function isHighPriority(type) {
  return ['new_request', 'request_accepted', 'qr_handshake'].includes(type);
}
