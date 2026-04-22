'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationGroup } from '@/types/notifications';
import { timeAgo } from '@/lib/notification-logic';
import { SingleNotifRow } from './SingleNotifRow';

interface DealGroupRowProps {
  group: NotificationGroup;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DealGroupRow({ group, onRead, onDelete }: DealGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const latest = group.items[0];
  const unreadCount = group.items.filter(n => !n.is_read).length;

  return (
    <motion.div layout className="border-b border-outline-variant/5">
      <div
        onClick={() => setExpanded(!expanded)}
        className={`
          flex gap-4 px-6 py-4 cursor-pointer transition-all duration-300
          hover:bg-surface-container-low/50
          ${unreadCount > 0 ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'}
        `}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-xl">handshake</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              Deal · {group.items.length} updates
            </span>
            <span className="text-[10px] font-medium text-on-surface-variant/40">
              {timeAgo(latest.created_at)}
            </span>
          </div>
          
          <p className={`text-sm leading-tight mb-1 truncate ${unreadCount > 0 ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
            {latest.title}
          </p>
          
          <p className="text-xs text-on-surface-variant/60 italic truncate">
            {group.items.map(n => n.title.split(' ').slice(0, 2).join(' ')).join(' → ')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-black rounded-full">
              {unreadCount}
            </span>
          )}
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            className="material-symbols-outlined text-lg text-on-surface-variant/30"
          >
            chevron_right
          </motion.span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-black/5"
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
