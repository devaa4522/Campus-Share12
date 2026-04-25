// types/notifications.ts
// Single source of truth for all notification-related types.
// Import from here in: useNotifications, NotificationBell, NotificationToast,
// NotificationsClient, notification-utils, notification-logic.

export type NotificationType =
  | 'new_request'
  | 'request_accepted'
  | 'request_rejected'
  | 'qr_handshake'
  | 'item_returned'
  | 'deal_completed'
  | 'new_message'
  | 'task_claimed'
  | 'task_completed'
  | 'karma_received'
  | 'karma_penalty'
  | 'system';

// Maps exactly to what Supabase returns from the notifications table.
// DB columns: id, user_id, title, body, type, is_read, created_at, data
// ⚠️  Requires this migration if not already run:
//   ALTER TABLE notifications RENAME COLUMN message TO body;
//   ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}';
export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string | number | boolean>;
  is_read: boolean;
  created_at: string;
}

// The legacy shape from NotificationsClient (archive page).
// Uses the same DB row — body field is the same column.
export type Notification = AppNotification;

// Filter tab identifiers used in NotificationsClient
export type FilterType = 'all' | 'unread' | 'deals' | 'messages' | 'karma';

// Which notification types belong to each filter tab
export const FILTER_CONFIG: Record<Exclude<FilterType, 'all' | 'unread'>, NotificationType[]> = {
  deals:    ['new_request', 'request_accepted', 'request_rejected', 'qr_handshake', 'item_returned', 'deal_completed'],
  messages: ['new_message'],
  karma:    ['karma_received', 'karma_penalty'],
};

// Per-type visual config used across Bell, Toast, and NotificationsClient.
// Accent colours stay within the app palette: campus green, amber, error red, neutral grey.
export const TYPE_CONFIG: Record<NotificationType, {
  icon: string;
  label: string;
  accent: string;
  bg: string;
}> = {
  new_request:      { icon: '📦', label: 'Borrow Request',  accent: '#006e0c', bg: 'rgba(0,110,12,0.07)'   },
  request_accepted: { icon: '✅', label: 'Accepted',        accent: '#006e0c', bg: 'rgba(0,110,12,0.07)'   },
  request_rejected: { icon: '❌', label: 'Declined',        accent: '#ba1a1a', bg: 'rgba(186,26,26,0.07)'  },
  qr_handshake:     { icon: '🤝', label: 'Handshake',       accent: '#006e0c', bg: 'rgba(0,110,12,0.07)'   },
  item_returned:    { icon: '↩️', label: 'Returned',        accent: '#b45309', bg: 'rgba(180,83,9,0.07)'   },
  deal_completed:   { icon: '🏆', label: 'Deal Closed',     accent: '#b45309', bg: 'rgba(180,83,9,0.07)'   },
  new_message:      { icon: '💬', label: 'Message',         accent: '#006e0c', bg: 'rgba(0,110,12,0.07)'   },
  task_claimed:     { icon: '⚡', label: 'Task Claimed',    accent: '#006e0c', bg: 'rgba(0,110,12,0.07)'   },
  task_completed:   { icon: '🎯', label: 'Task Done',       accent: '#006e0c', bg: 'rgba(0,110,12,0.07)'   },
  karma_received:   { icon: '⭐', label: 'Karma Earned',    accent: '#b45309', bg: 'rgba(180,83,9,0.07)'   },
  karma_penalty:    { icon: '⚠️', label: 'Karma Penalty',  accent: '#ba1a1a', bg: 'rgba(186,26,26,0.07)'  },
  system:           { icon: '🔔', label: 'System',          accent: '#6b7280', bg: 'rgba(107,114,128,0.07)'},
};

// Used by groupByDeal in notification-logic.ts
export type NotificationGroup = 
  | {
      type: 'single';
      notif: AppNotification;
    } 
  | {
      type: 'group';
      deal_id: string;
      items: AppNotification[];
      latestAt: string;
    };

export type GroupedNotification =
  | { type: 'single'; notif: AppNotification }
  | { type: 'group'; deal_id: string; items: AppNotification[]; latestAt: string };

// Re-exported alias used in DealGroupRow
export type NotificationGroupType = Extract<GroupedNotification, { type: 'group' }>;