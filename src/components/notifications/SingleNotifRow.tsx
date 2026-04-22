'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppNotification, TYPE_CONFIG } from '@/types/notifications';
import { timeAgo } from '@/lib/notification-logic';
import { getDeepLink } from '@/lib/notification-utils';
import { SwipeableRow } from './SwipeableRow';
import { ContextMenu } from './ContextMenu';
import { useRouter } from 'next/navigation';

interface SingleNotifRowProps {
  notif: AppNotification;
  onRead: () => void;
  onDelete: () => void;
  index: number;
  compact?: boolean;
}

export function SingleNotifRow({
  notif, onRead, onDelete, index, compact = false,
}: SingleNotifRowProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;

  const cancelLongPress = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const { clientX, clientY } = e;
    longPressRef.current = setTimeout(() => {
      setContextMenu({ x: clientX, y: clientY });
      if (navigator.vibrate) navigator.vibrate(28);
    }, 480);
  };

  const handleClick = () => {
    if (!notif.is_read) onRead();
    const link = getDeepLink(notif.type, notif.data);
    router.push(link);
  };

  const contextActions = [
    ...(!notif.is_read ? [{
      label: 'Mark as read',
      icon: 'done_all',
      color: '#006e0c',
      onClick: onRead,
    }] : []),
    {
      label: 'Delete',
      icon: 'delete',
      color: '#ba1a1a',
      onClick: onDelete,
    },
    ...(notif.data?.deal_id ? [{
      label: 'View deal',
      icon: 'handshake',
      onClick: () => router.push(`/dashboard?deal=${notif.data.deal_id}`),
    }] : []),
    ...(notif.data?.conversation_id ? [{
      label: 'Open message',
      icon: 'chat_bubble',
      onClick: () => router.push(`/messages?id=${notif.data.conversation_id}`),
    }] : []),
  ];

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.15) }}
      >
        <SwipeableRow onDelete={onDelete} onRead={onRead} isRead={notif.is_read}>
          <div
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            className={`
              flex gap-3.5 select-none cursor-pointer transition-colors duration-150
              hover:bg-surface-container-low/60 active:bg-surface-container-low
              ${compact ? 'px-7 py-3' : 'px-5 py-4'}
              ${!notif.is_read ? 'border-l-[3px] border-[#006e0c]' : 'border-l-[3px] border-transparent'}
            `}
            style={{
              background: notif.is_read ? 'transparent' : cfg.bg,
            }}
          >
            {/* Icon bubble */}
            <div
              className={`flex-shrink-0 flex items-center justify-center rounded-xl border
                ${compact ? 'w-8 h-8' : 'w-10 h-10'}`}
              style={{
                background: cfg.bg,
                borderColor: `${cfg.accent}22`,
              }}
            >
              <span className={compact ? 'text-base' : 'text-lg'}>{cfg.icon}</span>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              {/* Type label + timestamp */}
              <div className="flex justify-between items-center mb-0.5">
                <span
                  className="text-[10px] font-black uppercase tracking-[0.08em]"
                  style={{ color: cfg.accent }}
                >
                  {cfg.label}
                </span>
                <span className="text-[10px] font-medium text-on-surface-variant/40 tabular-nums">
                  {timeAgo(notif.created_at)}
                </span>
              </div>

              <p className={`text-sm leading-snug mb-0.5
                ${notif.is_read ? 'text-on-surface-variant font-normal' : 'text-on-surface font-semibold'}`}
              >
                {notif.title}
              </p>

              <p className="text-xs text-on-surface-variant/60 line-clamp-2 leading-relaxed">
                {notif.body}
              </p>
            </div>

            {/* Unread dot */}
            {!notif.is_read && (
              <div className="flex-shrink-0 self-center">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: cfg.accent,
                    boxShadow: `0 0 6px ${cfg.accent}80`,
                  }}
                />
              </div>
            )}
          </div>
        </SwipeableRow>
      </motion.div>

      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={contextActions}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}