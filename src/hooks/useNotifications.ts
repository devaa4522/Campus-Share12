// hooks/useNotifications.ts

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  AppNotification,
  NotificationType,
} from "@/types/notifications";

export type { AppNotification, NotificationType };

interface UseNotificationsReturn {
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

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";



// ── Convert base64url → Uint8Array ────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData  = window.atob(base64);
  const output   = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
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

export function useNotifications(): UseNotificationsReturn {
  const supabase   = useMemo(() => createClient(), []);
  const [isMounted, setIsMounted]       = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [pushEnabled, setPushEnabled]   = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const channelRef  = useRef<RealtimeChannel | null>(null);
  const userIdRef   = useRef<string | null>(null);
  // ADD THE DEBUG CODE HERE (after the state declarations):
useEffect(() => {
  console.log("🔧 VAPID Debug:", {
    hasKey: !!VAPID_PUBLIC_KEY,
    keyLength: VAPID_PUBLIC_KEY.length,
    keyStart: VAPID_PUBLIC_KEY.slice(0, 10) + "...",
    pushSupported,
    pushEnabled,
  });
}, [pushSupported, pushEnabled]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Hydration guard
  useEffect(() => { setIsMounted(true); }, []);

  // App badge (Android PWA)
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("setAppBadge" in navigator)) return;
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

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("[useNotifications] fetch error:", error);
      } else if (data) {
        setNotifications(data as AppNotification[]);
      }
      setIsLoading(false);
    },
    [supabase]
  );

  // Init: auth, push state, realtime
  useEffect(() => {
    if (!isMounted) return;
    let mounted = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        setIsLoading(false);
        return;
      }

      userIdRef.current = user.id;

      // Check push support
      if (typeof window !== "undefined") {
        const supported =
          "serviceWorker" in navigator && "PushManager" in window;
        setPushSupported(supported);

        if (supported) {
          try {
            const reg = await navigator.serviceWorker.getRegistration("/");
            if (reg) {
              const sub = await reg.pushManager.getSubscription();
              setPushEnabled(!!sub);
              console.log(
                "[useNotifications] Existing push subscription:",
                !!sub
              );
            }
          } catch (e) {
            console.error("[useNotifications] Push check error:", e);
          }
        }
      }

      await fetchNotifications(user.id);

      // Realtime subscription
      channelRef.current = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event:  "INSERT",
            schema: "public",
            table:  "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as AppNotification;
            setNotifications((prev) => {
              if (prev.some((x) => x.id === n.id)) return prev;
              return [n, ...prev];
            });

            // Fire in-app toast event
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("campusshare:notification", { detail: n })
              );
            }

            // Haptic feedback
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(getVibrationPattern(n.type));
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event:  "UPDATE",
            schema: "public",
            table:  "notifications",
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
          "postgres_changes",
          {
            event:  "DELETE",
            schema: "public",
            table:  "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const deletedId = (payload.old as { id: string }).id;
            setNotifications((prev) =>
              prev.filter((n) => n.id !== deletedId)
            );
          }
        )
        .subscribe((status) => {
          console.log("[useNotifications] Realtime status:", status);
        });
    }

    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isMounted, supabase, fetchNotifications]);

  // ── Enable push ──────────────────────────────────────────────
  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    if (!pushSupported) {
      console.error("[Push] Not supported on this browser");
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
      return false;
    }

    try {
      // 1. Request OS permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("[Push] Permission denied:", permission);
        return false;
      }

      // 2. Wait for SW to be ready
      const reg = await navigator.serviceWorker.ready;
      console.log("[Push] SW ready, scope:", reg.scope);

      // 3. Unsubscribe any stale subscription
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        console.log("[Push] Unsubscribed stale subscription");
      }

      // 4. Convert VAPID key correctly
      //    ⚠️ Must use .slice() not .buffer directly to avoid
      //    SharedArrayBuffer type mismatch and offset bugs
      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const applicationServerKey = keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength
      ) as ArrayBuffer;

      // 5. Subscribe
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:    true,
        applicationServerKey,
      });

      console.log("[Push] Subscribed:", subscription.endpoint.slice(0, 60));

      // 6. Extract keys
      const subJson = subscription.toJSON() as {
        endpoint: string;
        keys:     { p256dh: string; auth: string };
      };

      if (!subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Subscription missing p256dh or auth keys");
      }

      // 7. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 8. Upsert to DB (safe against duplicate endpoints)
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id:      user.id,
          endpoint:     subJson.endpoint,
          p256dh:       subJson.keys.p256dh,
          auth:         subJson.keys.auth,
          user_agent:   navigator.userAgent,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

      if (error) throw error;

      setPushEnabled(true);
      console.log("[Push] ✅ Subscription saved to DB");
      return true;
    } catch (err) {
      console.error("[Push] enablePushNotifications failed:", err);
      return false;
    }
  }, [pushSupported, supabase]);

  // ── Disable push ─────────────────────────────────────────────
  const disablePushNotifications = useCallback(async () => {
    if (typeof navigator === "undefined") return;

    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();

      if (sub) {
        // Remove from DB first
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);

        // Then unsubscribe from browser
        await sub.unsubscribe();
        console.log("[Push] Unsubscribed and removed from DB");
      }
    } catch (err) {
      console.error("[Push] disablePushNotifications error:", err);
    }

    setPushEnabled(false);
  }, [supabase]);

  // ── CRUD actions ─────────────────────────────────────────────
  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) console.error("[useNotifications] markAsRead:", error);
    },
    [supabase]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userIdRef.current) return;
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true }))
    );
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userIdRef.current)
      .eq("is_read", false);
    if (error) console.error("[useNotifications] markAllAsRead:", error);
  }, [supabase]);

  const deleteNotification = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) console.error("[useNotifications] deleteNotification:", error);
    },
    [supabase]
  );

  const clearAll = useCallback(async () => {
    if (!userIdRef.current) return;
    setNotifications([]);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userIdRef.current);
    if (error) console.error("[useNotifications] clearAll:", error);
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!userIdRef.current) return;
    await fetchNotifications(userIdRef.current);
  }, [fetchNotifications]);

  return {
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
  };
}