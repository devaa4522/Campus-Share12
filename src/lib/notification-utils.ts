// lib/notification-utils.ts
// Shared deep-link resolver. Import this in NotificationBell, NotificationToast,
// SingleNotifRow, and anywhere a notification needs to navigate.

import type { NotificationType } from '@/types/notifications';

type NotificationData = Record<string, string | number | boolean | null | undefined>;

function withParam(path: string, key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${key}=${encodeURIComponent(String(value))}`;
}

function dashboardDealLink(dealId: unknown, options?: { type?: 'item' | 'task'; scan?: boolean }): string {
  let path = withParam('/dashboard', 'deal', dealId);
  if (options?.type) path = withParam(path, 'type', options.type);
  if (options?.scan) path = withParam(path, 'scan', 'true');
  return path;
}

export function getDeepLink(
  type: NotificationType,
  data: NotificationData | undefined
): string {
  const d = data ?? {};

  switch (type) {
    case 'new_request':
      return dashboardDealLink(d.deal_id, { type: 'item' });
    case 'request_accepted':
      return dashboardDealLink(d.deal_id, { type: 'item', scan: true });
    case 'qr_handshake':
    case 'item_returned':
      return dashboardDealLink(d.deal_id, { type: 'item' });
    case 'request_rejected':
      return '/hub';
    case 'deal_completed':
      return dashboardDealLink(d.deal_id, { type: 'item' });
    case 'new_message':
      return withParam('/messages', 'id', d.conversation_id);
    case 'task_claimed':
    case 'task_completed':
      return dashboardDealLink(d.task_id, { type: 'task' });
    case 'karma_received':
    case 'karma_penalty':
      return '/profile';
    case 'system':
    default:
      return '/';
  }
}
