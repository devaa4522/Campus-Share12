// src/hooks/useNotifications.ts
// Compatibility wrapper: the NotificationsProvider is now the single source of truth.
// New code can import useNotificationsContext directly from '@/components/NotificationsProvider'.

import { useNotificationsContext } from '@/components/NotificationsProvider';
import type { AppNotification, NotificationType } from '@/types/notifications';

export type { AppNotification, NotificationType };

export function useNotifications() {
  return useNotificationsContext();
}
