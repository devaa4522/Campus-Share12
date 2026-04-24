'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { AppNotification, TYPE_CONFIG } from '@/types/notifications';
import { getDeepLink } from '@/lib/notification-utils';
import { groupByTime } from '@/lib/notification-logic';
import { createClient } from '@/utils/supabase/client';

// Add this inside the NotificationBell component
const supabase = createClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Notification row inside the bell dropdown ─────────────────────────────────

function BellRow({
  notif, onRead, onDelete,
}: { notif: AppNotification; onRead: (id: string) => void; onDelete: (id: string) => void }) {
  const cfg    = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;
  const router = useRouter();

  const handleClick = () => {
    if (!notif.is_read) onRead(notif.id);
    router.push(getDeepLink(notif.type, notif.data));
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32, transition: { duration: 0.16 } }}
      className="group relative border-b border-white/5 last:border-none"
    >
      <div
        onClick={handleClick}
        className="flex gap-3 px-5 py-3.5 cursor-pointer transition-colors duration-150 hover:bg-white/4 active:bg-white/6"
        style={{
          background: notif.is_read ? 'transparent' : cfg.bg,
          borderLeft: notif.is_read ? '3px solid transparent' : `3px solid ${cfg.accent}`,
        }}
      >
        {/* Icon */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base border mt-0.5"
          style={{ background: cfg.bg, borderColor: `${cfg.accent}22` }}
        >
          {cfg.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-[0.07em]" style={{ color: cfg.accent }}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-white/25 tabular-nums">{timeAgo(notif.created_at)}</span>
          </div>
          <p className={`text-[13px] leading-tight mb-0.5 ${notif.is_read ? 'text-white/50 font-normal' : 'text-white/88 font-semibold'}`}>
            {notif.title}
          </p>
          <p className="text-[11.5px] text-white/32 line-clamp-2 leading-relaxed">{notif.body}</p>
        </div>

        {/* Delete — appears on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
          className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-[#ba1a1a]/20 text-white/30 hover:text-[#ba1a1a] transition-all"
          aria-label="Delete notification"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </motion.div>
  );
}

// ── Push enable banner ────────────────────────────────────────────────────────

function PushBanner({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden border-b border-white/6 flex-shrink-0"
    >
      <div className="px-5 py-3 flex items-center gap-3 bg-[#006e0c]/8">
        <span className="text-base flex-shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white/75">Enable push notifications</p>
          <p className="text-[11px] text-white/30">Alerts even when the app is closed</p>
        </div>
        <button
          onClick={onEnable}
          className="flex-shrink-0 bg-[#006e0c] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
        >
          Enable
        </button>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-white/25 hover:text-white/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </motion.div>
  );
}

// ── Main bell component ───────────────────────────────────────────────────────

export function NotificationBell() {
  const {
    notifications, unreadCount, isLoading,
    pushEnabled, pushSupported, enablePushNotifications,
    markAsRead, markAllAsRead, deleteNotification, clearAll,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router   = useRouter();

  // Show push banner once
  useEffect(() => {
    if (pushSupported && !pushEnabled && !localStorage.getItem('cs:push-banner-dismissed')) {
      setShowPushBanner(true);
    }
  }, [pushSupported, pushEnabled]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // PWA hardware back
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ panel: 'notifications' }, '');
    const handler = () => setOpen(false);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
    // NOTE: do NOT call history.back() in the cleanup — that was the original double-fire bug.
  }, [open]);

  const handleEnablePush = async () => {
    const ok = await enablePushNotifications();
    if (ok) {
      setShowPushBanner(false);
      localStorage.setItem('cs:push-banner-dismissed', '1');
    }
  };

  const grouped = groupByTime(notifications);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
  <div className="relative" ref={panelRef}>
    {/* Bell button */}
    <button
      onClick={() => {
        if (!open && navigator.vibrate) navigator.vibrate(10);
        setOpen((v) => !v);
      }}
      className="w-10 h-10 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-95 relative"
      aria-label={mounted ? `Notifications — ${unreadCount} unread` : "Notifications"}
    >
      <motion.span
        animate={mounted && unreadCount > 0 ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
        className="material-symbols-outlined text-2xl"
      >
        notifications
      </motion.span>

      <AnimatePresence>
        {/* Only render the badge if mounted to avoid Hydration Error #418 */}
        {mounted && unreadCount > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-error text-white text-[10px] font-black rounded-full border-2 border-[#000a1e]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>

    {/* Dropdown panel */}
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1,    y: 0,  filter: 'blur(0px)' }}
          exit={{   opacity: 0, scale: 0.97, y: 8,  filter: 'blur(8px)'  }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className={`
            fixed inset-x-4 top-20
            sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3
            sm:w-[400px]
            flex flex-col max-h-[72vh] rounded-2xl
            bg-[#000a1e]/96 backdrop-blur-3xl
            border border-white/8
            shadow-[0_28px_72px_rgba(0,0,0,0.65)]
            overflow-hidden z-[100]
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6 flex-shrink-0 bg-white/2">
          <div className="px-5 py-3 border-b border-white/6 bg-red-500/10">
  <button
   onClick={async () => {
  console.log('🧪 Testing subscription creation...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('❌ No authenticated user');
    return;
  }
  
  // Test 1: Check if we can create a fake subscription for testing
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: user.id,
        endpoint: 'https://test-endpoint.com/test',
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
        user_agent: navigator.userAgent,
        last_used_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      console.error('❌ Database insert failed:', error);
    } else {
      console.log('✅ Test subscription created:', data);
      
      // Test 2: Now test the push API with a subscription
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/push-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          title: 'Test with Fake Subscription',
          body: 'Testing with a fake subscription in DB',
          type: 'system'
        })
      });
      
      const result = await response.json();
      console.log('🚀 API result with subscription:', result);
      
      // Clean up the test subscription
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', 'https://test-endpoint.com/test');
      console.log('🧹 Cleaned up test subscription');
    }
  } catch (err) {
    console.error('💥 Test failed:', err);
  }
}}
    className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-xs font-bold transition-colors"
  >
    🧪 Test Push Notification
  </button>
</div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[15px] font-bold text-white/90 tracking-tight">Notifications</h3>
              {mounted && unreadCount > 0 && (
                <span className="text-[10px] font-black bg-[#006e0c]/18 text-[#006e0c] border border-[#006e0c]/35 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {mounted && unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-bold text-[#006e0c] hover:text-[#006e0c]/80 transition-colors"
                >
                  Mark all read
                </button>
              )}
              {mounted && notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[11px] text-white/25 hover:text-white/50 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Push banner */}
          <AnimatePresence>
            {showPushBanner && (
              <PushBanner
                onEnable={handleEnablePush}
                onDismiss={() => {
                  setShowPushBanner(false);
                  localStorage.setItem('cs:push-banner-dismissed', '1');
                }}
              />
            )}
          </AnimatePresence>

          {/* List */}
          <div className="overflow-y-auto flex-1 scrollbar-none">
            {!mounted || isLoading ? (
              <div className="p-5 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-white/6 flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-0.5">
                      <div className="h-2.5 bg-white/8 rounded w-3/4" />
                      <div className="h-3.5 bg-white/6 rounded w-full" />
                      <div className="h-2 bg-white/4 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <span className="text-3xl mb-3 opacity-20">🔔</span>
                <p className="text-white/50 text-sm font-semibold">All caught up</p>
                <p className="text-white/25 text-xs mt-1">Deals, messages & karma appear here</p>
              </div>
            ) : (
              <div className="pb-2">
                {grouped.map(([label, items]) => (
                  <div key={label}>
                    {/* Section label */}
                    <div className="px-5 py-1.5 bg-white/2 border-b border-white/4">
                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/25">
                        {label}
                      </span>
                    </div>
                    <AnimatePresence mode="popLayout">
                      {items.map((n) => (
                        <BellRow
                          key={n.id}
                          notif={n}
                          onRead={markAsRead}
                          onDelete={deleteNotification}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-white/5 bg-white/2">
            <button
              onClick={() => { setOpen(false); router.push('/notifications'); }}
              className="w-full py-3 text-[12px] font-bold text-[#006e0c] hover:bg-white/4 transition-colors border-b border-white/4"
            >
              View full inbox
            </button>
            {pushSupported && (
              <div className="px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: mounted && pushEnabled ? '#006e0c' : 'rgba(255,255,255,0.2)',
                      boxShadow: mounted && pushEnabled ? '0 0 5px #006e0c' : 'none',
                    }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {mounted && pushEnabled ? 'Push active' : 'Push offline'}
                  </span>
                </div>
                {mounted && !pushEnabled && (
                  <button
                    onClick={handleEnablePush}
                    className="text-[10px] font-bold text-[#006e0c] border border-[#006e0c]/25 px-2.5 py-1 rounded-lg bg-[#006e0c]/8 hover:bg-[#006e0c]/15 transition-colors"
                  >
                    Enable push
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
}