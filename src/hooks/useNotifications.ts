// useNotifications.ts — no 'use client' needed on .ts hook files

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppNotification, NotificationType } from '@/types/notifications';

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
  refresh: () => Promise<void>;
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

interface NavigatorWithBadge extends Navigator {
  setAppBadge: (count?: number) => Promise<void>;
  clearAppBadge: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const supabase = useMemo(() => createClient(), []);
  const [isMounted, setIsMounted] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);

  const unreadCount = useMemo(() => 
    notifications.filter((n) => !n.is_read).length
  , [notifications]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update App Badge
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (unreadCount > 0) {
        (navigator as NavigatorWithBadge).setAppBadge?.(unreadCount).catch(console.error);
      } else {
        (navigator as NavigatorWithBadge).clearAppBadge?.().catch(console.error);
      }
    }
  }, [unreadCount]);

  const fetchNotifications = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setNotifications(data);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!isMounted) return;
    let mounted = true;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) {
        setIsLoading(false);
        return;
      }

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

      await fetchNotifications(user.id);

      // Setup Realtime
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
            setNotifications((prev) => {
              // Avoid duplicates
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });

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
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const deletedId = payload.old.id;
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        )
        .subscribe();
    }

    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isMounted, supabase, fetchNotifications]);

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
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
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
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) {
        // Rollback or refetch if needed
        console.error('Mark as read failed:', error);
      }
    },
    [supabase]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userIdRef.current) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase.rpc('mark_all_notifications_read', {
      p_user_id: userIdRef.current,
    });
    if (error) console.error('Mark all read failed:', error);
  }, [supabase]);

  const deleteNotification = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) console.error('Delete notification failed:', error);
    },
    [supabase]
  );

  const clearAll = useCallback(async () => {
    if (!userIdRef.current) return;
    setNotifications([]);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userIdRef.current);
    if (error) console.error('Clear all failed:', error);
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (userIdRef.current) {
      setIsLoading(true);
      await fetchNotifications(userIdRef.current);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (unreadCount > 0) {
        // @ts-ignore - setAppBadge is supported in modern PWA browsers but sometimes lacks TS definitions
        (navigator as any).setAppBadge(unreadCount).catch(console.error);
      } else {
        // @ts-ignore
        (navigator as any).clearAppBadge().catch(console.error);
      }
    }
  }, [unreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    pushEnabled,
    pushSupported,
    enablePushNotifications,
    disablePushNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh
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

