// lib/notification-utils.ts
// Shared notification formatting and deep-link resolver. Import this in
// NotificationBell, NotificationToast, SingleNotifRow, and anywhere a
// notification needs to display or navigate.

import type { AppNotification, NotificationType } from '@/types/notifications';

type NotificationData = Record<string, string | number | boolean | null | undefined>;

type DisplayNotification = {
  title: string;
  body: string;
  senderName: string;
  senderAvatar?: string | null;
};

function withParam(path: string, key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${key}=${encodeURIComponent(String(value))}`;
}

function firstPresent(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function notificationData(notifOrData: AppNotification | NotificationData | undefined): NotificationData {
  if (!notifOrData) return {};
  if ('data' in notifOrData && typeof notifOrData.data === 'object') {
    return (notifOrData.data ?? {}) as NotificationData;
  }
  return notifOrData as NotificationData;
}

export function getSenderName(notif: AppNotification | { data?: NotificationData; sender?: { full_name?: string | null } | null }): string {
  const data = notificationData(notif as AppNotification);
  return firstPresent(
    (notif as AppNotification).sender?.full_name,
    data.sender_name,
    data.actor_name,
    data.full_name,
    data.from_name,
    data.requester_name,
    data.helper_name,
    data.owner_name,
  ) ?? 'CampusShare';
}

export function getSenderAvatar(notif: AppNotification): string | null | undefined {
  const data = notificationData(notif);
  return firstPresent(
    notif.sender?.avatar_url,
    data.sender_avatar,
    data.avatar_url,
  );
}

function idFrom(data: NotificationData, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
  }
  return undefined;
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
  const conversationId = idFrom(d, 'conversation_id', 'conv_id', 'conversationId');
  const itemDealId = idFrom(d, 'deal_id', 'item_request_id', 'request_id', 'itemRequestId');
  const taskId = idFrom(d, 'task_id', 'deal_id', 'taskId');
  const explicitUrl = firstPresent(d.url, d.href, d.link);

  if (explicitUrl?.startsWith('/')) return explicitUrl;

  switch (type) {
    case 'new_request':
      return dashboardDealLink(itemDealId, { type: 'item' });
    case 'request_accepted':
      return dashboardDealLink(itemDealId, { type: 'item', scan: true });
    case 'qr_handshake':
    case 'item_returned':
      return dashboardDealLink(itemDealId, { type: 'item' });
    case 'request_rejected':
      return itemDealId ? dashboardDealLink(itemDealId, { type: 'item' }) : '/hub';
    case 'deal_completed':
      return itemDealId ? dashboardDealLink(itemDealId, { type: 'item' }) : '/profile';
    case 'new_message':
      return withParam('/messages', 'id', conversationId);
    case 'task_claimed':
    case 'task_completed':
      return dashboardDealLink(taskId, { type: 'task' });
    case 'karma_received':
    case 'karma_penalty':
      return '/profile';
    case 'system':
    default:
      return '/';
  }
}

export function formatNotification(notif: AppNotification): DisplayNotification {
  const senderName = getSenderName(notif);
  const senderAvatar = getSenderAvatar(notif);
  const rawTitle = notif.title?.trim() || 'CampusShare';
  const rawBody = notif.body?.trim() || '';
  const data = notificationData(notif);
  const itemTitle = firstPresent(data.item_title, data.title, data.item_name);
  const taskTitle = firstPresent(data.task_title, data.title);

  switch (notif.type) {
    case 'new_message':
      return {
        title: senderName,
        body: rawBody || 'Sent you a message.',
        senderName,
        senderAvatar,
      };
    case 'new_request':
      return {
        title: senderName === 'CampusShare' ? rawTitle : `New request from ${senderName}`,
        body: itemTitle ? `${senderName} wants to borrow ${itemTitle}.` : rawBody,
        senderName,
        senderAvatar,
      };
    case 'request_accepted':
      return {
        title: senderName === 'CampusShare' ? rawTitle : `${senderName} accepted your request`,
        body: itemTitle ? `Your request for ${itemTitle} was accepted.` : rawBody,
        senderName,
        senderAvatar,
      };
    case 'request_rejected':
      return {
        title: senderName === 'CampusShare' ? rawTitle : `${senderName} declined your request`,
        body: itemTitle ? `Your request for ${itemTitle} was declined.` : rawBody,
        senderName,
        senderAvatar,
      };
    case 'task_claimed':
      return {
        title: senderName === 'CampusShare' ? rawTitle : `${senderName} claimed your task`,
        body: taskTitle ? `${senderName} offered to help with “${taskTitle}”.` : rawBody,
        senderName,
        senderAvatar,
      };
    case 'task_completed':
      return {
        title: senderName === 'CampusShare' ? rawTitle : `${senderName} completed the task`,
        body: taskTitle ? `Review “${taskTitle}” and close the deal.` : rawBody,
        senderName,
        senderAvatar,
      };
    case 'qr_handshake':
      return {
        title: senderName === 'CampusShare' ? rawTitle : `Handshake update from ${senderName}`,
        body: rawBody || 'Open the deal to continue.',
        senderName,
        senderAvatar,
      };
    case 'deal_completed':
      return {
        title: senderName === 'CampusShare' ? rawTitle : `Deal completed with ${senderName}`,
        body: rawBody || 'Thanks for keeping CampusShare reliable.',
        senderName,
        senderAvatar,
      };
    case 'karma_received':
      return { title: rawTitle || 'Karma earned', body: rawBody, senderName, senderAvatar };
    case 'karma_penalty':
      return { title: rawTitle || 'Karma update', body: rawBody, senderName, senderAvatar };
    case 'system':
    default:
      return { title: 'CampusShare', body: rawBody || rawTitle, senderName: 'CampusShare', senderAvatar };
  }
}
