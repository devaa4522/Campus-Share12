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

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string | number | boolean | null>;
  is_read: boolean;
  created_at: string;
}

export type FilterType = 'all' | 'unread' | 'deals' | 'messages' | 'karma';

export const FILTER_CONFIG: Record<Exclude<FilterType, 'all' | 'unread'>, NotificationType[]> = {
  deals: ['new_request', 'request_accepted', 'request_rejected', 'qr_handshake', 'item_returned', 'deal_completed'],
  messages: ['new_message'],
  karma: ['karma_received', 'karma_penalty'],
};

export interface NotificationGroup {
  type: 'group';
  deal_id: string;
  items: AppNotification[];
  latestAt: string;
}

export interface SingleNotification {
  type: 'single';
  notif: AppNotification;
}

export type GroupedNotification = NotificationGroup | SingleNotification;
