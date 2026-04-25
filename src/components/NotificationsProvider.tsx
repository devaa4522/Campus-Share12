// src/components/NotificationsProvider.tsx
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppNotification, NotificationType } from '@/types/notifications';
import { formatNotification } from '@/lib/notification-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationsContextValue {
  notifications:            AppNotification[];
  unreadCount:              number;
  isLoading:                boolean;
  pushEnabled:              boolean;
  pushSupported:            boolean;
  enablePushNotifications:  () => Promise<boolean>;
  disablePushNotifications: () => Promise<void>;
  markAsRead:               (id: string) => Promise<void>;
  markAllAsRead:            () => Promise<void>;
  deleteNotification:       (id: string) => Promise<void>;
  clearAll:                 () => Promise<void>;
  refresh:                  () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function getVibrationPattern(type: NotificationType): number[] {
  const patterns: Partial<Record<NotificationType, number[]>> = {
    new_request:      [100, 50, 100],
    request_accepted: [200, 100, 200, 100, 400],
    request_rejected: [500],
    new_message:      [50, 50, 50],
    deal_completed:   [100, 50, 100, 50, 300],
    karma_received:   [100, 100, 200],
    karma_penalty:    [300, 100, 300],
    task_claimed:     [150, 50, 150],
  };
  return patterns[type] ?? [100];
}

type NotificationRow = AppNotification & {
  sender?: { full_name?: string | null; avatar_url?: string | null } | null;
};

function normalizeNotification(row: NotificationRow): AppNotification {
  const data = { ...(row.data ?? {}) } as AppNotification['data'];
  const senderName = row.sender?.full_name?.trim();
  const senderAvatar = row.sender?.avatar_url?.trim();
  if (senderName && !data.sender_name) data.sender_name = senderName;
  if (senderAvatar && !data.sender_avatar) data.sender_avatar = senderAvatar;

  const normalized: AppNotification = {
    ...row,
    data,
    sender: row.sender ?? null,
  };

  const display = formatNotification(normalized);
  return {
    ...normalized,
    title: display.title,
    body: display.body,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [pushEnabled,   setPushEnabled]   = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const channelRef  = useRef<RealtimeChannel | null>(null);
  const userIdRef   = useRef<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );


  // App badge sync
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!('setAppBadge' in navigator)) return;
    const nav = navigator as Navigator & {
      setAppBadge: (n: number) => Promise<void>;
      clearAppBadge: () => Promise<void>;
    };
    if (unreadCount > 0) {
      nav.setAppBadge(unreadCount).catch(console.error);
    } else {
      nav.clearAppBadge().catch(console.error);
    }
  }, [unreadCount]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async (userId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*, sender:profiles!notifications_sender_id_fkey(full_name, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) console.error('[Notifications] fetch error:', error);
    else if (data) setNotifications((data as unknown as NotificationRow[]).map(normalizeNotification));

    setIsLoading(false);
  }, [supabase]);

  // ── Init: auth + push check + realtime ────────────────────────────────────

  useEffect(() => {
    if (!isMounted) return;
    let alive = true;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) { setIsLoading(false); return; }

      userIdRef.current = user.id;

      // Check push support
      if (typeof window !== 'undefined') {
        const supported = 'serviceWorker' in navigator && 'PushManager' in window;
        setPushSupported(supported);
        if (supported) {
          try {
            const reg = await navigator.serviceWorker.getRegistration('/');
            if (reg) {
              const sub = await reg.pushManager.getSubscription();
              setPushEnabled(!!sub);
            }
          } catch (e) {
            console.error('[Notifications] push check error:', e);
          }
        }
      }

      await fetchNotifications(user.id);

      // ── Single Realtime channel for this user ──────────────────────────
      channelRef.current = supabase
        .channel(`notifications_ctx:${user.id}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            let n = normalizeNotification(payload.new as NotificationRow);
            const { data: hydrated } = await supabase
              .from('notifications')
              .select('*, sender:profiles!notifications_sender_id_fkey(full_name, avatar_url)')
              .eq('id', n.id)
              .maybeSingle();
            if (hydrated) n = normalizeNotification(hydrated as unknown as NotificationRow);

            setNotifications((prev) => {
              if (prev.some((x) => x.id === n.id)) return prev;
              return [n, ...prev];
            });

            // Toast event (picked up by NotificationToastContainer)
            window.dispatchEvent(
              new CustomEvent('campusshare:notification', { detail: n })
            );

            // Haptics
            if (navigator.vibrate) navigator.vibrate(getVibrationPattern(n.type));
          }
        )
        .on(
          'postgres_changes',
          {
            event:  'UPDATE',
            schema: 'public',
            table:  'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = normalizeNotification(payload.new as NotificationRow);
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event:  'DELETE',
            schema: 'public',
            table:  'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const deletedId = (payload.old as { id: string }).id;
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        )
        .subscribe((status) => {
          console.log('[Notifications] Realtime:', status);
        });
    }

    init();

    return () => {
      alive = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isMounted, supabase, fetchNotifications]);

  // ── Push enable ───────────────────────────────────────────────────────────

  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    const supported =
      'serviceWorker' in navigator &&
      'PushManager'   in window    &&
      'Notification'  in window;

    if (!supported || !VAPID_PUBLIC_KEY) {
      console.error('[Push] Not supported or VAPID key missing');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;

      // Remove stale subscription
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', existing.endpoint);
      }

      // Convert VAPID key
      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const applicationServerKey = keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength
      ) as ArrayBuffer;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subJson = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      if (!subJson.keys?.p256dh || !subJson.keys?.auth) {
        await subscription.unsubscribe();
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { await subscription.unsubscribe(); return false; }

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id:     user.id,
          endpoint:    subJson.endpoint,
          p256dh:      subJson.keys.p256dh,
          auth:        subJson.keys.auth,
          user_agent:  navigator.userAgent,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

      if (error) { await subscription.unsubscribe(); return false; }

      setPushEnabled(true);
      return true;
    } catch (err) {
      console.error('[Push] enable error:', err);
      return false;
    }
  }, [supabase]);

  // ── Push disable ──────────────────────────────────────────────────────────

  const disablePushNotifications = useCallback(async () => {
    if (typeof navigator === 'undefined') return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (err) {
      console.error('[Push] disable error:', err);
    }
    setPushEnabled(false);
  }, [supabase]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const markAsRead = useCallback(async (id: string) => {
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: id,
    });
    if (error) {
      console.error('[Notifications] markAsRead:', error);
      setNotifications(previous);
      throw error;
    }
  }, [notifications, supabase]);

  const markAllAsRead = useCallback(async () => {
    if (!userIdRef.current) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      console.error('[Notifications] markAllAsRead:', error);
      setNotifications(previous);
      throw error;
    }
  }, [notifications, supabase]);

  const deleteNotification = useCallback(async (id: string) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.rpc('delete_notification', {
      p_notification_id: id,
    });
    if (error) {
      console.error('[Notifications] delete:', error);
      setNotifications(previous);
      throw error;
    }
  }, [notifications, supabase]);

  const clearAll = useCallback(async () => {
    if (!userIdRef.current) return;
    const previous = notifications;
    setNotifications([]);
    const { error } = await supabase.rpc('clear_my_notifications');
    if (error) {
      console.error('[Notifications] clearAll:', error);
      setNotifications(previous);
      throw error;
    }
  }, [notifications, supabase]);

  const refresh = useCallback(async () => {
    if (!userIdRef.current) return;
    await fetchNotifications(userIdRef.current);
  }, [fetchNotifications]);

  // ── Context value ─────────────────────────────────────────────────────────

  const value = useMemo<NotificationsContextValue>(() => ({
    notifications:            isMounted ? notifications : [],
    unreadCount:              isMounted ? unreadCount   : 0,
    isLoading:                isMounted ? isLoading     : true,
    pushEnabled,
    pushSupported,
    enablePushNotifications,
    disablePushNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
  }), [
    isMounted, notifications, unreadCount, isLoading,
    pushEnabled, pushSupported,
    enablePushNotifications, disablePushNotifications,
    markAsRead, markAllAsRead, deleteNotification, clearAll, refresh,
  ]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext must be used inside <NotificationsProvider>');
  return ctx;
}