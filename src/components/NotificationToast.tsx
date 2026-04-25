'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { AppNotification, TYPE_CONFIG } from '@/types/notifications';
import { formatNotification, getDeepLink } from '@/lib/notification-utils';
import { useNotificationsContext } from '@/components/NotificationsProvider';

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const router = useRouter();
  const { markAsRead } = useNotificationsContext();

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const notif = (e as CustomEvent<AppNotification>).detail;
      setToasts((prev) => [notif, ...prev].slice(0, 3));
      const timer = setTimeout(() => dismiss(notif.id), 5000);
      timers.current.set(notif.id, timer);
    };
    window.addEventListener('campusshare:notification', handler);
    return () => {
      window.removeEventListener('campusshare:notification', handler);
      timers.current.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      try { await markAsRead(notif.id); } catch { /* provider already rolled back/logged */ }
    }
    const link = getDeepLink(notif.type, notif.data);
    if (link) router.push(link);
    dismiss(notif.id);
  };

  return (
    <div
      className="fixed z-[110] flex flex-col gap-2 pointer-events-none"
      style={{
        // Mobile: above BottomNav — Desktop: bottom-right
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 400,
      }}
    >
      {/* On md+: override to bottom-right */}
      <style>{`
        @media (min-width: 768px) {
          .toast-root { left: auto !important; transform: none !important; right: 24px; bottom: 24px; }
        }
      `}</style>
      <div className="toast-root flex flex-col gap-2 pointer-events-none w-full">
        <AnimatePresence>
          {toasts.map((toast) => {
            const cfg = TYPE_CONFIG[toast.type] ?? TYPE_CONFIG.system;
            const display = formatNotification(toast);
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0,  scale: 1    }}
                exit={{   opacity: 0, y: 8,   scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                onClick={() => handleClick(toast)}
                role="alert"
                aria-live="assertive"
                className="pointer-events-auto w-full cursor-pointer"
              >
                <div
                  className="flex items-center gap-3.5 p-4 rounded-2xl shadow-2xl border"
                  style={{
                    background: 'rgba(0,10,30,0.94)',
                    backdropFilter: 'blur(20px)',
                    borderColor: `${cfg.accent}35`,
                    borderLeft: `4px solid ${cfg.accent}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                  }}
                >
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg border"
                    style={{ background: cfg.bg, borderColor: `${cfg.accent}22` }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[11px] font-black uppercase tracking-[0.08em] mb-0.5"
                      style={{ color: cfg.accent }}
                    >
                      {cfg.label}
                    </p>
                    <p className="text-sm font-semibold text-white/90 leading-tight truncate">
                      {display.title}
                    </p>
                    <p className="text-xs text-white/45 line-clamp-1 leading-snug mt-0.5">
                      {display.body}
                    </p>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-colors self-start"
                    aria-label="Dismiss"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}