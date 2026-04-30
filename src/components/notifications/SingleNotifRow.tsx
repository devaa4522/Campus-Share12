'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppNotification, TYPE_CONFIG } from '@/types/notifications';
import { timeAgo } from '@/lib/notification-logic';
import { formatNotification, getDeepLink } from '@/lib/notification-utils';
import { SwipeableRow } from './SwipeableRow';
import { useRouter } from 'next/navigation';

interface SingleNotifRowProps {
  notif: AppNotification;
  onRead: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  index: number;
  compact?: boolean;
}

export function SingleNotifRow({
  notif, onRead, onDelete, index, compact = false,
}: SingleNotifRowProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);
  const router = useRouter();

  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;
  const display = formatNotification(notif);

  const handleClick = async () => {
    if (actionsOpen) {
      setCloseSignal((value) => value + 1);
      return;
    }

    if (!notif.is_read) {
      try { await onRead(); } catch { /* provider already rolled back/logged */ }
    }

    router.prefetch(getDeepLink(notif.type, notif.data));
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.15) }}
      >
        <SwipeableRow
          onDelete={onDelete}
          onRead={onRead}
          isRead={notif.is_read}
          onOpenChange={setActionsOpen}
          closeSignal={closeSignal}
        >
          <div
            onClick={handleClick}
            className={`
              flex gap-3.5 select-none cursor-pointer transition-colors duration-150
              hover:bg-surface-container-low/60 active:bg-surface-container-low
              ${compact ? 'px-7 py-3' : 'px-5 py-4'}
              ${!notif.is_read ? 'border-l-[3px] border-secondary' : 'border-l-[3px] border-transparent'}
            `}
            style={{
              background: notif.is_read ? 'transparent' : cfg.bg,
            }}
          >
            {/* Icon bubble */}
            <div
              className={`shrink-0 flex items-center justify-center rounded-xl border
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
                {display.title}
              </p>

              <p className="text-xs text-on-surface-variant/60 line-clamp-2 leading-relaxed">
                {display.body}
              </p>
            </div>

            {/* Unread dot */}
            {!notif.is_read && (
              <div className="shrink-0 self-center">
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
    </>
  );
}