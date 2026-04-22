'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { AppNotification } from '@/types/notifications';
import { groupByTime } from '@/lib/notification-logic';
import { getDeepLink } from '@/lib/notification-utils';
import { useRouter } from 'next/navigation';

// Theme configuration matching your app's dark navy (#000a1e) and campus green (#006e0c)
const TYPE_CONFIG: Record<string, { icon: string; label: string; accent: string; bg: string }> = {
  new_request:      { icon: "📦", label: "Borrow Request",  accent: "#006e0c", bg: "rgba(0, 110, 12, 0.08)" },
  request_accepted: { icon: "✅", label: "Accepted",        accent: "#006e0c", bg: "rgba(0, 110, 12, 0.08)" },
  request_rejected: { icon: "❌", label: "Declined",        accent: "#ef4444", bg: "rgba(239, 68, 68, 0.08)" },
  qr_handshake:     { icon: "🤝", label: "Handshake",       accent: "#006e0c", bg: "rgba(0, 110, 12, 0.08)" },
  item_returned:    { icon: "↩️", label: "Returned",        accent: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
  deal_completed:   { icon: "🏆", label: "Deal Closed",     accent: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
  new_message:      { icon: "💬", label: "Message",         accent: "#006e0c", bg: "rgba(0, 110, 12, 0.08)" },
  karma_received:   { icon: "⭐", label: "Karma Earned",    accent: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
  karma_penalty:    { icon: "⚠️", label: "Karma Penalty",   accent: "#ef4444", bg: "rgba(239, 68, 68, 0.08)" },
  system:           { icon: "🔔", label: "System",          accent: "#6b7280", bg: "rgba(107, 114, 128, 0.08)" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function DualToneRow({ notif, onRead, onDelete, index }: { notif: AppNotification, onRead: (id: string) => void, onDelete: (id: string) => void, index: number }) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  const router = useRouter();

  const handleTap = () => {
    if (!notif.is_read) onRead(notif.id);
    const link = getDeepLink(notif.type, notif.data);
    if (link) router.push(link);
  };

  return (
    <div className="relative overflow-hidden group border-b border-white/5">
      {/* Swipe Reveal Layers */}
      <div className="absolute inset-0 bg-error/20 flex items-center px-4 justify-end pointer-events-none">
        <span className="text-error text-xs font-bold uppercase tracking-wider">Delete</span>
      </div>
      {!notif.is_read && (
        <div className="absolute inset-0 bg-[#006e0c]/20 flex items-center px-4 justify-start pointer-events-none">
          <span className="text-[#006e0c] text-xs font-bold uppercase tracking-wider">Mark Read</span>
        </div>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x > 70) onDelete(notif.id);
          if (info.offset.x < -70 && !notif.is_read) onRead(notif.id);
        }}
        onClick={handleTap}
        className="relative z-10 cursor-pointer active:cursor-grabbing transition-colors duration-200"
        style={{
          display: "flex",
          gap: "12px",
          padding: "14px 20px",
          background: notif.is_read ? "#000a1e" : cfg.bg,
          borderLeft: notif.is_read ? "3px solid transparent" : `3px solid ${cfg.accent}`,
        }}
      >
        <div style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.accent}22`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
        }}>
          {cfg.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: cfg.accent }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
              {timeAgo(notif.created_at)}
            </span>
          </div>

          <p style={{ fontSize: 13, fontWeight: notif.is_read ? 400 : 600, color: notif.is_read ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.92)", lineHeight: 1.35, marginBottom: 4, marginTop: 0 }}>
            {notif.title}
          </p>

          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {notif.body}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, pushEnabled, pushSupported, enablePushNotifications, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="w-10 h-10 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 active:scale-95 group relative"
        onClick={() => {
          if (!open && navigator.vibrate) navigator.vibrate(10);
          setOpen(!open);
        }}
      >
        <motion.span 
          animate={unreadCount > 0 ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
          className="material-symbols-outlined text-2xl"
        >
          notifications
        </motion.span>

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full border-2 border-[#000a1e]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.97, y: 8, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-4 w-auto sm:w-[420px] max-h-[70vh] rounded-2xl bg-[#000a1e]/95 backdrop-blur-3xl border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col z-[100]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white/5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-bold text-base">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-[#006e0c]/20 text-[#006e0c] border border-[#006e0c]/40 px-2 py-0.5 rounded-full font-bold uppercase">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[11px] text-[#006e0c] font-bold hover:underline">Mark all read</button>
                )}
                {notifications.length > 0 && (
                  <button onClick={clearAll} className="text-[11px] text-white/40 hover:text-white transition-colors">Clear all</button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 scrollbar-none">
              {isLoading ? (
                <div className="p-6 text-center text-white/40 text-sm">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <span className="text-4xl opacity-20 material-symbols-outlined">notifications_off</span>
                  <p className="text-white/60 font-bold mt-2">All caught up</p>
                  <p className="text-white/30 text-xs mt-1">Deals, messages & karma appear here</p>
                </div>
              ) : (
                <div className="pb-4">
                  {groupByTime(notifications).map(([label, items]: [string, AppNotification[]]) => (
                    <div key={label}>
                      <div className="px-5 py-2 text-[10px] font-bold tracking-widest uppercase text-white/30 bg-[#000a1e]">
                        {label}
                      </div>
                      {items.map((notif: AppNotification, i: number) => (
                        <DualToneRow key={notif.id} notif={notif} index={i} onRead={markAsRead} onDelete={deleteNotification} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with Inbox Link & Push Status */}
            <div className="flex flex-col border-t border-white/5 bg-white/5">
              <button 
                onClick={() => { setOpen(false); router.push('/notifications'); }}
                className="w-full py-3 text-xs font-bold text-[#006e0c] hover:bg-white/5 transition-colors border-b border-white/5"
              >
                View full inbox
              </button>
              
              {pushSupported && (
                <div className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${pushEnabled ? 'bg-[#006e0c] shadow-[0_0_6px_#006e0c]' : 'bg-white/20'}`} />
                    <span className="text-[10px] font-bold tracking-widest uppercase text-white/40">
                      {pushEnabled ? "Push Active" : "Push Offline"}
                    </span>
                  </div>
                  {!pushEnabled && (
                    <button onClick={enablePushNotifications} className="text-[10px] text-[#006e0c] font-bold border border-[#006e0c]/30 px-2 py-1 rounded bg-[#006e0c]/10">
                      Enable Push
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