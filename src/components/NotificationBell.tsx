'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification, NotificationType } from '@/hooks/useNotifications';
import { Package, CheckCircle, XCircle, Handshake, CornerDownLeft, Trophy, MessageSquare, Zap, Target, Star, AlertTriangle, Bell } from 'lucide-react';

const ICONS: Record<NotificationType, React.ReactNode> = {
  new_request:      <Package className="w-5 h-5 text-primary" />,
  request_accepted: <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />,
  request_rejected: <XCircle className="w-5 h-5 text-error" />,
  qr_handshake:     <Handshake className="w-5 h-5 text-primary" />,
  item_returned:    <CornerDownLeft className="w-5 h-5 text-secondary" />,
  deal_completed:   <Trophy className="w-5 h-5 text-[#F59E0B]" />,
  new_message:      <MessageSquare className="w-5 h-5 text-primary" />,
  task_claimed:     <Zap className="w-5 h-5 text-secondary" />,
  task_completed:   <Target className="w-5 h-5 text-[var(--color-success)]" />,
  karma_received:   <Star className="w-5 h-5 text-[#F59E0B]" />,
  karma_penalty:    <AlertTriangle className="w-5 h-5 text-error" />,
  system:           <Bell className="w-5 h-5 text-on-surface-variant" />,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getDeepLink(type: NotificationType, data: Record<string, string | number | boolean> | undefined): string {
  const safeData = data || {};
  const routes: Partial<Record<NotificationType, string>> = {
    new_request:      `/dashboard?deal=${safeData.deal_id}`,
    request_accepted: `/dashboard?deal=${safeData.deal_id}&scan=true`,
    qr_handshake:     `/dashboard?deal=${safeData.deal_id}`,
    deal_completed:   `/profile`,
    new_message:      `/messages?conv=${safeData.conversation_id}`,
    task_claimed:     `/tasks?task=${safeData.task_id}`,
    karma_received:   `/profile`,
    system:           `/`,
  };
  return routes[type] || '/';
}

function NotificationRow({
  notif,
  onRead,
  onDelete,
}: {
  notif: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (!notif.is_read) onRead(notif.id);
    router.push(getDeepLink(notif.type, notif.data));
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      className={`
        group relative flex items-start gap-4 px-6 py-4 cursor-pointer
        transition-all duration-300 hover:bg-white/10
        ${!notif.is_read ? 'bg-secondary/5' : ''}
      `}
      onClick={handleClick}
    >
      {!notif.is_read && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-secondary" />
      )}

      <span className="flex-shrink-0 mt-0.5 select-none">
        {ICONS[notif.type] || <Bell className="w-5 h-5 text-on-surface-variant" />}
      </span>

      <div className="flex-1 min-w-0 space-y-1">
        <p className={`text-sm leading-snug ${notif.is_read ? 'text-on-surface-variant' : 'text-on-surface font-bold'}`}>
          {notif.title}
        </p>
        <p className="text-xs text-on-surface-variant/70 line-clamp-2 leading-relaxed">
          {notif.body}
        </p>
        <p className="text-[10px] text-on-surface-variant/50 font-medium uppercase tracking-wider">{timeAgo(notif.created_at)}</p>
      </div>

      <button
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 bg-white/10 hover:bg-error/20 hover:text-error transition-all p-1.5 rounded-lg flex items-center justify-center transform active:scale-90"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notif.id);
        }}
        aria-label="Delete notification"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </motion.div>
  );
}

function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <motion.div
      animate={hasUnread ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
      className="flex items-center justify-center"
    >
      <span className="material-symbols-outlined text-2xl">notifications</span>
    </motion.div>
  );
}

function PushBanner({
  onEnable,
  onDismiss,
}: {
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-b border-outline-variant/30 overflow-hidden"
    >
      <div className="px-4 py-3 bg-primary-container/20 flex items-center gap-3">
        <span className="text-xl material-symbols-outlined text-primary">campaign</span>
        <div className="flex-1 min-w-0">
          <p className="text-on-surface text-xs font-medium">Enable push notifications</p>
          <p className="text-on-surface-variant text-[11px]">Get alerts even when the app is closed</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onEnable}
            className="text-xs bg-primary text-on-primary px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            Enable
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-on-surface-variant px-2 transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isLoading,
    pushEnabled,
    pushSupported,
    enablePushNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (!open && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (pushSupported && !pushEnabled) {
      const dismissed = localStorage.getItem('cs:push-banner-dismissed');
      if (!dismissed) setShowPushBanner(true);
    }
  }, [pushSupported, pushEnabled]);

  // Handle closing on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Handle "Back" to close on mobile/PWA
  useEffect(() => {
    if (open) {
      // Push a dummy state to history so "back" can be intercepted
      window.history.pushState({ panel: 'notifications' }, '');
      
      const handlePopState = (e: PopStateEvent) => {
        // If we popped away from the notification state, close the panel
        setOpen(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        // Clean up history state if closed via button click instead of back button
        if (window.history.state?.panel === 'notifications') {
          window.history.back();
        }
      };
    }
  }, [open]);

  const handleEnablePush = async () => {
    const success = await enablePushNotifications();
    if (success) {
      setShowPushBanner(false);
      localStorage.setItem('cs:push-banner-dismissed', '1');
    }
  };

  const handleDismissBanner = () => {
    setShowPushBanner(false);
    localStorage.setItem('cs:push-banner-dismissed', '1');
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="w-10 h-10 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 active:scale-95 group relative"
        onClick={toggleOpen}
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <BellIcon hasUnread={unreadCount > 0} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-error text-on-error text-[10px] font-bold rounded-full border-2 border-surface"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-4 w-auto sm:w-[420px] rounded-3xl bg-surface/80 backdrop-blur-3xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col z-[100] editorial-shadow ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0 bg-white/5">
              <div className="flex items-center gap-3">
                <h3 className="text-on-surface font-headline font-bold text-lg tracking-tight">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-secondary text-on-secondary px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm shadow-secondary/20">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-primary hover:text-primary-container transition-colors font-medium"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[11px] text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {showPushBanner && (
                <PushBanner onEnable={handleEnablePush} onDismiss={handleDismissBanner} />
              )}
            </AnimatePresence>

            <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/10">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest flex-shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-surface-container-highest rounded w-3/4" />
                        <div className="h-2.5 bg-surface-container-high rounded w-full" />
                        <div className="h-2 bg-surface-container-low rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <span className="material-symbols-outlined text-4xl mb-4 text-on-surface-variant/40">notifications_off</span>
                  <p className="text-on-surface-variant text-sm font-medium">All caught up!</p>
                  <p className="text-on-surface-variant/60 text-xs mt-1">
                    You'll see deals, messages & karma updates here
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {notifications.map((notif) => (
                    <NotificationRow
                      key={notif.id}
                      notif={notif}
                      onRead={markAsRead}
                      onDelete={deleteNotification}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {pushSupported && (
              <div className="flex-shrink-0 border-t border-white/10 px-6 py-3.5 flex items-center justify-between bg-white/5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                  {pushEnabled ? '🟢 Service Active' : '⚪ Service Offline'}
                </span>
                {!pushEnabled && (
                  <button
                    onClick={handleEnablePush}
                    className="text-[11px] text-secondary hover:text-secondary-fixed-dim transition-colors font-black uppercase tracking-tighter"
                  >
                    Enable Push
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
