'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { AppNotification, NotificationType } from '@/hooks/useNotifications';
import { getDeepLink } from '@/lib/notification-utils';

// Map specific visual styles to notification types
const ACCENT: Record<NotificationType, string> = {
  new_request:      'from-primary/20 border-primary/40 text-primary',
  request_accepted: 'from-[var(--color-success)]/20 border-[var(--color-success)]/40 text-[var(--color-success)]',
  request_rejected: 'from-error/20 border-error/40 text-error',
  qr_handshake:     'from-primary/20 border-primary/40 text-primary',
  item_returned:    'from-secondary/20 border-secondary/40 text-secondary',
  deal_completed:   'from-[#F59E0B]/20 border-[#F59E0B]/40 text-[#F59E0B]',
  new_message:      'from-primary/10 border-primary/30 text-primary',
  task_claimed:     'from-secondary/20 border-secondary/40 text-secondary',
  task_completed:   'from-[var(--color-success)]/20 border-[var(--color-success)]/40 text-[var(--color-success)]',
  karma_received:   'from-[#F59E0B]/30 border-[#F59E0B]/50 text-[#F59E0B]',
  karma_penalty:    'from-error/30 border-error/50 text-error',
  system:           'from-surface-container-high border-outline-variant text-on-surface',
};

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

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const router = useRouter();

  // Listen for realtime events dispatched by useNotifications hook
  useEffect(() => {
    const handleNewNotif = (event: Event) => {
      const customEvent = event as CustomEvent<AppNotification>;
      const notif = customEvent.detail;
      
      setToasts((prev) => [notif, ...prev].slice(0, 3)); // Keep max 3 toasts

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notif.id));
      }, 5000);
    };

    window.addEventListener('campusshare:notification', handleNewNotif);
    return () => window.removeEventListener('campusshare:notification', handleNewNotif);
  }, []);

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClick = (notif: AppNotification) => {
    const link = getDeepLink(notif.type, notif.data);
    if (link) {
      router.push(link);
    }
    handleDismiss(notif.id);
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-6 md:left-auto md:translate-x-0 md:right-6 z-[100] flex flex-col gap-2 pointer-events-none px-4 md:px-0 w-full max-w-[400px]">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`
              pointer-events-auto w-full 
              bg-surface-container-lowest glass-effect shadow-xl
              rounded-2xl overflow-hidden border border-l-4
              ${ACCENT[toast.type] || ACCENT.system}
              bg-gradient-to-r to-transparent
              cursor-pointer flex items-center p-4 gap-4 editorial-shadow
            `}
            onClick={() => handleClick(toast)}
            role="alert"
            aria-live="assertive"
          >
            <div className="flex-shrink-0 text-3xl drop-shadow-sm select-none">
              {ICONS[toast.type] || '🔔'}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-on-surface font-semibold text-sm leading-tight mb-1">
                {toast.title}
              </p>
              <p className="text-on-surface-variant text-xs line-clamp-2 leading-snug">
                {toast.body}
              </p>
            </div>

            <button
              onClick={(e) => handleDismiss(toast.id, e)}
              className="flex-shrink-0 text-on-surface-variant/50 hover:text-on-surface p-1.5 transition-colors self-start -mt-2 -mr-2 rounded-full hover:bg-surface-container-high"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
