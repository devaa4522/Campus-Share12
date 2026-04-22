'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { FilterType, FILTER_CONFIG } from '@/types/notifications';
import { groupByTime, groupByDeal } from '@/lib/notification-logic';
import { PullToRefresh }  from './notifications/PullToRefresh';
import { SectionHeader }  from './notifications/SectionHeader';
import { SingleNotifRow } from './notifications/SingleNotifRow';
import { DealGroupRow }   from './notifications/DealGroupRow';

const FILTERS: { id: FilterType; label: string; icon: string }[] = [
  { id: 'all',      label: 'All',      icon: 'all_inbox'         },
  { id: 'unread',   label: 'Unread',   icon: 'mark_chat_unread'  },
  { id: 'deals',    label: 'Deals',    icon: 'handshake'         },
  { id: 'messages', label: 'Messages', icon: 'chat'              },
  { id: 'karma',    label: 'Karma',    icon: 'stars'             },
];

const VIEW_MODES = [
  { id: 'time' as const, label: 'Timeline', icon: 'schedule'  },
  { id: 'deal' as const, label: 'By Deal',  icon: 'handshake' },
  { id: 'flat' as const, label: 'Flat',     icon: 'segment'   },
];

export default function NotificationsClient() {
  const {
    notifications, isLoading,
    markAsRead, deleteNotification, markAllAsRead, clearAll, refresh,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [groupMode, setGroupMode]   = useState<'time' | 'deal' | 'flat'>('time');

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filtered = useMemo(() => notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.is_read;
    if (activeFilter === 'all')    return true;
    return FILTER_CONFIG[activeFilter as keyof typeof FILTER_CONFIG]?.includes(n.type) ?? true;
  }), [notifications, activeFilter]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-28 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-5">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/20">notifications_off</span>
      </div>
      <h3 className="text-base font-bold text-on-surface mb-1">Nothing here</h3>
      <p className="text-sm text-on-surface-variant/50 max-w-xs leading-relaxed">
        No updates in this category. Pull down to refresh or try a different filter.
      </p>
    </motion.div>
  );

  const renderSkeleton = () => (
    <div className="p-6 space-y-5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex-shrink-0" />
          <div className="flex-1 space-y-2.5 py-0.5">
            <div className="h-2 bg-surface-container-high rounded w-1/4" />
            <div className="h-3.5 bg-surface-container-highest rounded w-3/4" />
            <div className="h-2.5 bg-surface-container-low rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    if (isLoading) return renderSkeleton();
    if (filtered.length === 0) return renderEmpty();

    if (groupMode === 'deal') {
      const groups = groupByDeal(filtered);
      return (
        <div className="divide-y divide-outline-variant/6 pb-20">
          {groups.map((g, i) =>
            g.type === 'group' ? (
              <DealGroupRow
                key={g.deal_id}
                group={g}
                onRead={markAsRead}
                onDelete={deleteNotification}
              />
            ) : (
              <SingleNotifRow
                key={g.notif.id}
                notif={g.notif}
                onRead={() => markAsRead(g.notif.id)}
                onDelete={() => deleteNotification(g.notif.id)}
                index={i}
              />
            )
          )}
        </div>
      );
    }

    if (groupMode === 'time') {
      const sections = groupByTime(filtered);
      return (
        <div className="pb-20">
          {sections.map(([label, items]) => (
            <div key={label}>
              <SectionHeader label={label} count={items.length} />
              <div className="divide-y divide-outline-variant/6">
                {items.map((notif, i) => (
                  <SingleNotifRow
                    key={notif.id}
                    notif={notif}
                    onRead={() => markAsRead(notif.id)}
                    onDelete={() => deleteNotification(notif.id)}
                    index={i}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Flat
    return (
      <div className="divide-y divide-outline-variant/6 pb-20">
        <AnimatePresence mode="popLayout">
          {filtered.map((notif, i) => (
            <SingleNotifRow
              key={notif.id}
              notif={notif}
              onRead={() => markAsRead(notif.id)}
              onDelete={() => deleteNotification(notif.id)}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col min-h-screen bg-surface md:pt-20">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 md:top-20 z-30 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/10 px-5 pt-6 pb-4">

        {/* Title row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-on-surface">Inbox</h1>
            {unreadCount > 0 && (
              <span className="bg-primary text-on-primary text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md shadow-primary/15">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11.5px] font-bold text-primary hover:bg-primary/6 px-3 py-1.5 rounded-lg transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={clearAll}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error/8 text-on-surface-variant/30 hover:text-error transition-colors"
              title="Clear all"
            >
              <span className="material-symbols-outlined text-xl">delete_sweep</span>
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 -mx-5 px-5">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            const cnt = f.id === 'unread' ? unreadCount
              : f.id === 'all' ? notifications.length
              : FILTER_CONFIG[f.id as keyof typeof FILTER_CONFIG]
                ? notifications.filter((n) => FILTER_CONFIG[f.id as keyof typeof FILTER_CONFIG]?.includes(n.type)).length
                : 0;

            return (
              <motion.button
                key={f.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl whitespace-nowrap text-sm font-bold transition-all flex-shrink-0
                  ${isActive
                    ? 'bg-primary text-on-primary shadow-md shadow-primary/15 scale-105'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
              >
                <span className="material-symbols-outlined text-[17px]">{f.icon}</span>
                {f.label}
                {cnt > 0 && (
                  <span className={`text-[10px] font-black ${isActive ? 'opacity-60' : 'opacity-40'}`}>
                    {cnt}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* View mode toggle */}
        <div className="flex mt-4 p-1 bg-surface-container-low rounded-xl w-fit gap-0.5">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setGroupMode(mode.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all
                ${groupMode === mode.id
                  ? 'bg-surface shadow-sm text-primary'
                  : 'text-on-surface-variant/40 hover:text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined text-[15px]">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <PullToRefresh onRefresh={refresh}>
        <div className="max-w-3xl mx-auto w-full min-h-[calc(100vh-260px)]">
          {renderContent()}
        </div>
      </PullToRefresh>
    </main>
  );
}