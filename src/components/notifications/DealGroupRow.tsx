'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationGroupType } from '@/types/notifications';
import { timeAgo } from '@/lib/notification-logic';
import { SingleNotifRow } from './SingleNotifRow';

interface DealGroupRowProps {
  group: NotificationGroupType;
  onRead: (id: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

export function DealGroupRow({ group, onRead, onDelete }: DealGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const latest     = group.items[0];
  const unread     = group.items.filter((n) => !n.is_read).length;
  const hasUnread  = unread > 0;

  // Build a short "journey" string from item titles
  const journey = group.items
    .slice()
    .reverse()
    .map((n) => n.title.split(' ').slice(0, 2).join(' '))
    .join(' → ');

  return (
    <motion.div layout className="border-b border-outline-variant/6">
      {/* Collapsed header row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        className={`flex gap-3.5 px-5 py-4 cursor-pointer transition-colors duration-150
          hover:bg-surface-container-low/60 active:bg-surface-container-low
          ${hasUnread ? 'border-l-[3px] border-primary' : 'border-l-[3px] border-transparent'}`}
        style={{ background: hasUnread ? 'rgba(0,110,12,0.05)' : 'transparent' }}
      >
        {/* Icon */}
        <div className="shrink-0 w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant/15 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-xl">handshake</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Label + time */}
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-primary">
              Deal · {group.items.length} updates
            </span>
            <span className="text-[10px] text-on-surface-variant/40 tabular-nums">
              {timeAgo(latest.created_at)}
            </span>
          </div>

          {/* Latest title */}
          <p className={`text-sm leading-snug mb-0.5 truncate
            ${hasUnread ? 'text-on-surface font-semibold' : 'text-on-surface-variant font-normal'}`}
          >
            {latest.title}
          </p>

          {/* Journey breadcrumb */}
          <p className="text-[11px] text-on-surface-variant/40 truncate italic">{journey}</p>
        </div>

        {/* Badge + chevron */}
        <div className="flex items-center gap-2 shrink-0 self-center">
          {hasUnread && (
            <span className="px-2 py-0.5 bg-primary/12 text-primary text-[10px] font-black rounded-full border border-primary/20">
              {unread}
            </span>
          )}
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.18 }}
            className="material-symbols-outlined text-lg text-on-surface-variant/30"
          >
            chevron_right
          </motion.span>
        </div>
      </div>

      {/* Expanded children */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-surface-container-low/20"
          >
            {group.items.map((notif, i) => (
              <SingleNotifRow
                key={notif.id}
                notif={notif}
                onRead={() => onRead(notif.id)}
                onDelete={() => onDelete(notif.id)}
                index={i}
                compact
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}