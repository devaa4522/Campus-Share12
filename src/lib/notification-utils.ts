// lib/notification-utils.ts
// Shared deep-link resolver. Import this in NotificationBell, NotificationToast,
// SingleNotifRow, and anywhere a notification needs to navigate.

import { NotificationType } from '@/types/notifications';

export function getDeepLink(
  type: NotificationType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> | undefined
): string {
  const d = data ?? {};
  const routes: Partial<Record<NotificationType, string>> = {
    new_request:      `/dashboard?deal=${d.deal_id}`,
    request_accepted: `/dashboard?deal=${d.deal_id}&scan=true`,
    qr_handshake:     `/dashboard?deal=${d.deal_id}`,
    deal_completed:   `/profile`,
    new_message:      `/messages?id=${d.conversation_id}`,
    task_claimed:     `/tasks?task=${d.task_id}`,
    task_completed:   `/tasks?task=${d.task_id}`,
    karma_received:   `/profile`,
    karma_penalty:    `/profile`,
    system:           `/`,
  };
  return routes[type] ?? '/';
}