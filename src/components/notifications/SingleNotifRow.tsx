'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppNotification } from '@/types/notifications';
import { timeAgo } from '@/lib/notification-logic';
import { SwipeableRow } from './SwipeableRow';
import { ContextMenu } from './ContextMenu';
import { useRouter } from 'next/navigation';
import { getDeepLink } from '@/lib/notification-utils';

interface SingleNotifRowProps {
  notif: AppNotification;
  onRead: () => void;
  onDelete: () => void;
  index: number;
  compact?: boolean;
}

export function SingleNotifRow({ notif, onRead, onDelete, index, compact = false }: SingleNotifRowProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const handlePointerDown = (e: React.PointerEvent) => {
    const { clientX, clientY } = e;
    longPressRef.current = setTimeout(() => {
      setContextMenu({ x: clientX, y: clientY });
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const handleClick = () => {
    if (!notif.is_read) onRead();
    const link = getDeepLink(notif.type, notif.data);
    if (link) router.push(link);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_request': return 'package_2';
      case 'request_accepted': return 'check_circle';
      case 'request_rejected': return 'cancel';
      case 'new_message': return 'chat_bubble';
      case 'karma_received': return 'stars';
      case 'karma_penalty': return 'warning';
      default: return 'notifications';
    }
  };

  const getAccentColor = (type: string) => {
    if (type.includes('error') || type.includes('penalty')) return 'text-error bg-error/10 border-error/20';
    if (type.includes('accepted') || type.includes('completed')) return 'text-success bg-success/10 border-success/20';
    if (type.includes('karma')) return 'text-secondary bg-secondary/10 border-secondary/20';
    return 'text-primary bg-primary/10 border-primary/20';
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
        transition={{ duration: 0.2, delay: index * 0.03 }}
      >
        <SwipeableRow onDelete={onDelete} onRead={onRead} isRead={notif.is_read}>
          <div
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`
              flex gap-4 select-none cursor-pointer transition-all duration-300
              ${compact ? 'px-8 py-3' : 'px-6 py-4'}
              ${notif.is_read ? 'opacity-60' : 'bg-primary/5'}
              ${!compact && !notif.is_read ? 'border-l-4 border-primary' : 'border-l-4 border-transparent'}
            `}
          >
            <div className={`
              flex-shrink-0 flex items-center justify-center rounded-xl border
              ${compact ? 'w-8 h-8' : 'w-10 h-10'}
              ${getAccentColor(notif.type)}
            `}>
              <span className={`material-symbols-outlined ${compact ? 'text-lg' : 'text-xl'}`}>
                {getIcon(notif.type)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className={`text-[9px] font-black uppercase tracking-widest ${notif.is_read ? 'text-on-surface-variant/40' : 'text-primary'}`}>
                  {notif.type.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] font-medium text-on-surface-variant/30">
                  {timeAgo(notif.created_at)}
                </span>
              </div>
              <p className={`text-sm leading-tight mb-0.5 ${notif.is_read ? 'text-on-surface-variant font-medium' : 'text-on-surface font-bold'}`}>
                {notif.title}
              </p>
              <p className="text-xs text-on-surface-variant/70 line-clamp-2 leading-relaxed">
                {notif.body}
              </p>
            </div>

            {!notif.is_read && (
              <div className="flex-shrink-0 flex items-center justify-center self-center">
                <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.5)]" />
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
            onClose={() => setContextMenu(null)}
            actions={[
              ...(!notif.is_read ? [{
                label: 'Mark as read',
                icon: 'done_all',
                color: 'var(--color-success)',
                onClick: onRead
              }] : []),
              {
                label: 'Delete Forever',
                icon: 'delete',
                color: 'var(--color-error)',
                onClick: onDelete
              },
              ...(notif.data?.deal_id ? [{
                label: 'View Deal Details',
                icon: 'handshake',
                onClick: () => router.push(`/deals/${notif.data.deal_id}`)
              }] : [])
            ]}
          />
        )}
      </AnimatePresence>
    </>
  );
}
