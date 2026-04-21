'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────

export type NotificationType =
  | 'new_request' | 'request_accepted' | 'request_rejected'
  | 'qr_handshake' | 'item_returned' | 'deal_completed'
  | 'new_message' | 'task_claimed' | 'task_completed'
  | 'karma_received' | 'karma_penalty' | 'system';

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

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  pushEnabled: boolean;
  pushSupported: boolean;
  enablePushNotifications: () => Promise<boolean>;
  disablePushNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Hook ─────────────────────────────────────────────────────

export function useNotifications(): UseNotificationsReturn {
  const supabase = useMemo(() => createClient(), []);
  const [isMounted, setIsMounted] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);

  const unreadCount = isMounted ? notifications.filter((n) => !n.is_read).length : 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    let mounted = true;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      userIdRef.current = user.id;

      if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        const supported = 'serviceWorker' in navigator && 'PushManager' in window;
        setPushSupported(supported);

        if (supported) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            const sub = await reg.pushManager.getSubscription();
            setPushEnabled(!!sub);
          }
        }
      }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (mounted) {
        setNotifications(data || []);
        setIsLoading(false);
      }

      channelRef.current = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as AppNotification;
            setNotifications((prev) => [newNotif, ...prev]);

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('campusshare:notification', { detail: newNotif })
              );
            }

            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(getVibrationPattern(newNotif.type));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as AppNotification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            );
          }
        )
        .subscribe();
    }

    init();

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
    };
  }, [isMounted, supabase]);

  useEffect(() => {
    if (!isMounted) return;
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registered:', reg.scope))
        .catch((err) => console.error('[SW] Registration failed:', err));

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NAVIGATE') {
          window.location.href = event.data.url;
        }
      });
    }
  }, [isMounted]);

  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (!pushSupported || !VAPID_PUBLIC_KEY) {
      console.warn('[Push] Not supported or VAPID key missing');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      });

      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

      if (error) throw error;

      setPushEnabled(true);
      return true;
    } catch (err) {
      console.error('[Push] Enable failed:', err);
      return false;
    }
  }, [pushSupported, supabase]);

  const disablePushNotifications = useCallback(async () => {
    if (typeof navigator === 'undefined') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();

    if (sub) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }

    setPushEnabled(false);
  }, [supabase]);

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
    },
    [supabase]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userIdRef.current) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.rpc('mark_all_notifications_read', {
      p_user_id: userIdRef.current,
    });
  }, [supabase]);

  const deleteNotification = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      await supabase.from('notifications').delete().eq('id', id);
    },
    [supabase]
  );

  const clearAll = useCallback(async () => {
    if (!userIdRef.current) return;
    setNotifications([]);
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userIdRef.current);
  }, [supabase]);

  return {
    notifications: isMounted ? notifications : [],
    unreadCount,
    isLoading: isMounted ? isLoading : true,
    pushEnabled,
    pushSupported,
    enablePushNotifications,
    disablePushNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
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
  return patterns[type] || [100];
}
