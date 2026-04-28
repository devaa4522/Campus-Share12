// src/components/NotificationsClient.tsx
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationsContext } from '@/components/NotificationsProvider';
import { FilterType, FILTER_CONFIG } from '@/types/notifications';
import { groupByTime, groupByDeal } from '@/lib/notification-logic';
import { SectionHeader }  from './notifications/SectionHeader';
import { SingleNotifRow } from './notifications/SingleNotifRow';
import { DealGroupRow }   from './notifications/DealGroupRow';

// ── Constants ────────────────────────────────────────────────────────────────

const FILTERS: { id: FilterType; label: string; icon: string }[] = [
  { id: 'all',      label: 'All',      icon: 'all_inbox'        },
  { id: 'unread',   label: 'Unread',   icon: 'mark_chat_unread' },
  { id: 'deals',    label: 'Deals',    icon: 'handshake'        },
  { id: 'messages', label: 'Messages', icon: 'chat'             },
  { id: 'karma',    label: 'Karma',    icon: 'stars'            },
];

const VIEW_MODES = [
  { id: 'time' as const, label: 'Timeline', icon: 'schedule'  },
  { id: 'deal' as const, label: 'By Deal',  icon: 'handshake' },
  { id: 'flat' as const, label: 'Flat',     icon: 'segment'   },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationsClient() {
  const {
    notifications, isLoading,
    markAsRead, deleteNotification, markAllAsRead, clearAll, refresh,
  } = useNotificationsContext();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [groupMode,    setGroupMode]    = useState<'time' | 'deal' | 'flat'>('time');
  const [clearing,     setClearing]     = useState(false);

  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const totalCount  = notifications.length;

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => notifications.filter((n) => {
    if (activeFilter === 'all')    return true;
    if (activeFilter === 'unread') return !n.is_read;
    return FILTER_CONFIG[activeFilter as keyof typeof FILTER_CONFIG]?.includes(n.type) ?? true;
  }), [notifications, activeFilter]);

  const countFor = (id: FilterType): number => {
    if (id === 'all')    return totalCount;
    if (id === 'unread') return unreadCount;
    const types = FILTER_CONFIG[id as keyof typeof FILTER_CONFIG];
    return types ? notifications.filter((n) => types.includes(n.type)).length : 0;
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimerRef.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmClear(false);
    setClearing(true);
    clearAll().finally(() => setClearing(false));
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <div className="px-4 pt-3 pb-24 space-y-1">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="flex gap-3.5 px-4 py-4 rounded-2xl animate-pulse"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="w-10 h-10 rounded-xl bg-surface-container-highest shrink-0
" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="flex justify-between">
              <div className="h-2 bg-surface-container-highest rounded-full w-16" />
              <div className="h-2 bg-surface-container-high rounded-full w-10" />
            </div>
            <div className="h-3.5 bg-surface-container-highest rounded-full w-3/4" />
            <div className="h-2.5 bg-surface-container-high rounded-full w-full" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmpty = () => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1,  y: 0  }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-28 px-8 text-center"
    >
      <motion.div
        initial={{ scale: 0.7 }}
        animate={{ scale: 1   }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        className="w-20 h-20 rounded-3xl bg-surface-container-high
                   flex items-center justify-center mb-6 shadow-sm"
      >
        <span className="material-symbols-outlined text-4xl text-on-surface-variant/25">
          {activeFilter === 'unread' ? 'done_all' : 'notifications_off'}
        </span>
      </motion.div>

      <h3 className="text-lg font-black text-on-surface mb-2">
        {activeFilter === 'unread' ? 'All caught up!' : 'Nothing here'}
      </h3>
      <p className="text-sm text-on-surface-variant/50 max-w-xs leading-relaxed">
        {activeFilter === 'unread'
          ? 'You have no unread notifications. Check back later.'
          : 'No updates in this category. Pull down to refresh or try a different filter.'}
      </p>

      {activeFilter !== 'all' && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          onClick={() => setActiveFilter('all')}
          className="mt-6 px-5 py-2.5 rounded-2xl bg-primary/10 text-primary
                     text-sm font-bold hover:bg-primary/15 transition-colors"
        >
          Show all notifications
        </motion.button>
      )}
    </motion.div>
  );

  const renderContent = () => {
    if (isLoading) return renderSkeleton();
    if (filtered.length === 0) return renderEmpty();

    if (groupMode === 'deal') {
      const groups = groupByDeal(filtered);
      return (
        <div className="pb-28">
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
                onRead={()   => markAsRead(g.notif.id)}
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
        <div className="pb-28">
          {sections.map(([label, items]) => (
            <div key={label}>
              <SectionHeader label={label} count={items.length} />
              <div className="divide-y divide-outline-variant/8">
                {items.map((notif, i) => (
                  <SingleNotifRow
                    key={notif.id}
                    notif={notif}
                    onRead={()   => markAsRead(notif.id)}
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
      <div className="divide-y divide-outline-variant/8 pb-28">
        <AnimatePresence mode="popLayout">
          {filtered.map((notif, i) => (
            <SingleNotifRow
              key={notif.id}
              notif={notif}
              onRead={()   => markAsRead(notif.id)}
              onDelete={() => deleteNotification(notif.id)}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      className="
        flex flex-col w-full
        h-full min-h-0
        bg-surface overflow-hidden
      "
    >
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div
        className="
          shrink-0

          sticky top-0 z-30
          bg-surface/95 backdrop-blur-xl
          border-b border-outline-variant/10
          px-5 pt-5 pb-3
          shadow-[0_1px_0_0_rgba(0,0,0,0.04)]
        "
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-on-surface leading-none">
              Inbox
            </h1>
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{   scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="
                    bg-primary text-on-primary
                    text-[10px] font-black
                    px-2.5 py-0.5 rounded-full
                    uppercase tracking-wider
                    shadow-sm shadow-primary/20
                  "
                >
                  {unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={refresh}
              className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant/45 hover:bg-surface-container-high active:bg-surface-container-highest transition-colors"
              aria-label="Refresh notifications"
            >
              <span className="material-symbols-outlined text-xl">sync</span>
            </button>

            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0  }}
                  exit={{   opacity: 0, x: 10  }}
                  onClick={markAllAsRead}
                  className="
                    flex items-center gap-1.5
                    text-[12px] font-bold text-primary
                    hover:bg-primary/8 active:bg-primary/12
                    px-3 py-1.5 rounded-xl
                    transition-colors
                  "
                >
                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                  <span className="hidden sm:inline">Mark all read</span>
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {confirmClear ? (
                <motion.button
                  key="confirm"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1,    opacity: 1 }}
                  exit={{   scale: 0.85, opacity: 0 }}
                  onClick={handleClearAll}
                  className="
                    flex items-center gap-1.5
                    text-[12px] font-black text-error
                    bg-error/10 hover:bg-error/15 active:bg-error/20
                    px-3 py-1.5 rounded-xl
                    border border-error/20
                    transition-colors
                  "
                >
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Confirm?
                </motion.button>
              ) : (
                <motion.button
                  key="clear"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1,    opacity: 1 }}
                  exit={{   scale: 0.85, opacity: 0 }}
                  onClick={handleClearAll}
                  disabled={clearing || totalCount === 0}
                  className="
                    w-9 h-9 flex items-center justify-center rounded-full
                    text-on-surface-variant/40
                    hover:bg-error/8 hover:text-error
                    active:bg-error/12
                    disabled:opacity-30 disabled:pointer-events-none
                    transition-colors
                  "
                >
                  {clearing ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="material-symbols-outlined text-xl"
                    >
                      sync
                    </motion.span>
                  ) : (
                    <span className="material-symbols-outlined text-xl">delete_sweep</span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Filter pills — ONLY this scrolls horizontally */}
        <div
          className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-0.5"
          style={{ touchAction: 'pan-x' }}
        >
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            const cnt      = countFor(f.id);

            return (
              <motion.button
                key={f.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => setActiveFilter(f.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2 rounded-2xl
                  whitespace-nowrap text-sm font-bold
                  transition-all duration-200 shrink-0

                  ${isActive
                    ? 'bg-primary text-on-primary shadow-md shadow-primary/20 scale-[1.04]'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}
                `}
              >
                <span className="material-symbols-outlined text-[17px]">{f.icon}</span>
                {f.label}
                {cnt > 0 && (
                  <span className={`text-[10px] font-black tabular-nums ${isActive ? 'opacity-70' : 'opacity-40'}`}>
                    {cnt}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* View mode toggle */}
        <div className="flex mt-3.5 p-1 bg-surface-container-low rounded-xl w-fit gap-0.5">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setGroupMode(mode.id)}
              className={`
                flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg
                text-[11px] font-black uppercase tracking-wider
                transition-all duration-200
                ${groupMode === mode.id
                  ? 'bg-surface shadow-sm text-primary'
                  : 'text-on-surface-variant/40 hover:text-on-surface-variant'}
              `}
            >
              <span className="material-symbols-outlined text-[15px]">{mode.icon}</span>
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <AnimatePresence>
        {!isLoading && totalCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{   height: 0, opacity: 0 }}
            className="shrink-0
 overflow-hidden"
          >
            <div className="flex items-center gap-4 px-5 py-2 bg-surface-container-low/40 border-b border-outline-variant/6">
              <StatPill icon="notifications" value={totalCount} label="total" color="text-on-surface-variant/50" />
              {unreadCount > 0 && (
                <StatPill icon="mark_chat_unread" value={unreadCount} label="unread" color="text-primary" />
              )}
              <div className="flex-1" />
              {filtered.length !== totalCount && (
                <span className="text-[10px] text-on-surface-variant/35 font-medium">
                  Showing {filtered.length}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable notification list */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-3xl mx-auto w-full">
          {renderContent()}
        </div>
      </div>
    </main>
  );
}

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ icon, value, label, color }: {
  icon: string; value: number; label: string; color: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <span className="material-symbols-outlined text-[13px]">{icon}</span>
      <span className="text-[11px] font-black tabular-nums">{value}</span>
      <span className="text-[10px] font-medium opacity-60">{label}</span>
    </div>
  );
} 
