'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification, NotificationType } from '@/hooks/useNotifications';

const ICONS: Record<NotificationType, string> = {
  new_request:      '📦',
  request_accepted: '✅',
  request_rejected: '❌',
  qr_handshake:     '🤝',
  item_returned:    '↩️',
  deal_completed:   '🏆',
  new_message:      '💬',
  task_claimed:     '⚡',
  task_completed:   '🎯',
  karma_received:   '⭐',
  karma_penalty:    '⚠️',
  system:           '🔔',
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

function getDeepLink(type: NotificationType, data: Record<string, string | number | boolean>): string {
  const routes: Partial<Record<NotificationType, string>> = {
    new_request:      `/dashboard?deal=${data.deal_id}`,
    request_accepted: `/dashboard?deal=${data.deal_id}&scan=true`,
    qr_handshake:     `/dashboard?deal=${data.deal_id}`,
    deal_completed:   `/profile`,
    new_message:      `/messages?conv=${data.conversation_id}`,
    task_claimed:     `/tasks?task=${data.task_id}`,
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
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      className={`
        group relative flex items-start gap-3 px-4 py-3.5 cursor-pointer
        transition-colors hover:bg-surface-container-high
        ${!notif.is_read ? 'bg-primary/5' : ''}
      `}
      onClick={handleClick}
    >
      {!notif.is_read && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-secondary" />
      )}

      <span className="flex-shrink-0 text-xl leading-none mt-0.5 select-none">
        {ICONS[notif.type] || '🔔'}
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${notif.is_read ? 'text-on-surface-variant' : 'text-on-surface font-medium'}`}>
          {notif.title}
        </p>
        <p className="text-xs text-on-surface-variant/80 mt-0.5 line-clamp-2 leading-relaxed">
          {notif.body}
        </p>
        <p className="text-[10px] text-on-surface-variant/60 mt-1">{timeAgo(notif.created_at)}</p>
      </div>

      <button
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-on-surface-variant hover:text-error transition-all p-1 -mr-1 -mt-1 rounded-md hover:bg-surface-container-highest"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notif.id);
        }}
        aria-label="Delete notification"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </motion.div>
  );
}

function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <motion.div
      animate={hasUnread ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
      className="flex items-center justify-center p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface font-medium cursor-pointer"
    >
      <span className="material-symbols-outlined font-variation-settings-fill-1">notifications</span>
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

  useEffect(() => {
    if (pushSupported && !pushEnabled) {
      const dismissed = localStorage.getItem('cs:push-banner-dismissed');
      if (!dismissed) setShowPushBanner(true);
    }
  }, [pushSupported, pushEnabled]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleEnablePush = async () => {
    const success = await enablePushNotifications();
    if (success) {
      setShowPushBanner(false);
      localStorage.removeItem('cs:push-banner-dismissed');
    }
  };

  const handleDismissBanner = () => {
    setShowPushBanner(false);
    localStorage.setItem('cs:push-banner-dismissed', '1');
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
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
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute right-0 top-full mt-2 w-[340px] md:w-[380px] max-h-[80vh] md:max-h-[520px] bg-surface-container-lowest glass-effect border border-outline-variant/30 rounded-2xl shadow-xl overflow-hidden flex flex-col z-50 editorial-shadow"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-outline-variant/30 flex-shrink-0 bg-surface-container-lowest">
              <div className="flex items-center gap-2">
                <h3 className="text-on-surface font-headline font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-primary text-on-primary px-2 py-0.5 rounded-full font-medium">
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
              <div className="flex-shrink-0 border-t border-outline-variant/30 px-4 py-2.5 flex items-center justify-between bg-surface-container-lowest">
                <span className="text-[11px] text-on-surface-variant">
                  {pushEnabled ? '🟢 Push notifications on' : '⚪ Push notifications off'}
                </span>
                {!pushEnabled && (
                  <button
                    onClick={handleEnablePush}
                    className="text-[11px] text-primary hover:text-primary-container transition-colors font-semibold"
                  >
                    Enable
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
