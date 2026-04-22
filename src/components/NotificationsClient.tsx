"use client";

import { useState, useMemo } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { FilterType, FILTER_CONFIG } from "@/types/notifications";
import { groupByTime, groupByDeal } from "@/lib/notification-logic";
import { PullToRefresh } from "./notifications/PullToRefresh";
import { SectionHeader } from "./notifications/SectionHeader";
import { SingleNotifRow } from "./notifications/SingleNotifRow";
import { DealGroupRow } from "./notifications/DealGroupRow";
import { AnimatePresence, motion } from "framer-motion";

const FILTERS: { id: FilterType; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "all_inbox" },
  { id: "unread", label: "Unread", icon: "mark_chat_unread" },
  { id: "deals", label: "Deals", icon: "handshake" },
  { id: "messages", label: "Messages", icon: "chat" },
  { id: "karma", label: "Karma", icon: "stars" },
];

export default function NotificationsClient() {
  const { 
    notifications, 
    isLoading, 
    markAsRead, 
    deleteNotification, 
    markAllAsRead, 
    clearAll,
    refresh 
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [groupMode, setGroupMode] = useState<"time" | "deal" | "flat">("time");

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === "unread") return !n.is_read;
      if (activeFilter === "all") return true;
      const types = FILTER_CONFIG[activeFilter as keyof typeof FILTER_CONFIG];
      return types?.includes(n.type);
    });
  }, [notifications, activeFilter]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-8 space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex-shrink-0" />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-2 bg-surface-container-high rounded w-1/4" />
                <div className="h-4 bg-surface-container-highest rounded w-3/4" />
                <div className="h-3 bg-surface-container-low rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 px-6 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl opacity-20">notifications_off</span>
          </div>
          <h3 className="text-lg font-bold text-on-surface mb-2">No notifications found</h3>
          <p className="text-sm text-on-surface-variant/60 max-w-xs">
            We couldn&apos;t find any updates in this category. Pull down to refresh or try another filter.
          </p>
        </motion.div>
      );
    }

    if (groupMode === "deal") {
      const groups = groupByDeal(filtered);
      return (
        <div className="divide-y divide-outline-variant/5">
          {groups.map((g, i) => 
            g.type === "group" ? (
              <DealGroupRow 
                key={g.deal_id} 
                group={g} 
                onRead={(id) => markAsRead(id)} 
                onDelete={(id) => deleteNotification(id)} 
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

    if (groupMode === "time") {
      const sections = groupByTime(filtered);
      return (
        <div className="pb-20">
          {sections.map(([label, items]) => (
            <div key={label}>
              <SectionHeader label={label} count={items.length} />
              <div className="divide-y divide-outline-variant/5">
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

    return (
      <div className="divide-y divide-outline-variant/5 pb-20">
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
      {/* Sticky Header */}
      <div className="sticky top-0 md:top-20 z-30 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black tracking-tight text-on-surface">Inbox</h1>
            {unreadCount > 0 && (
              <span className="bg-primary text-on-primary text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg shadow-primary/20">
                {unreadCount} New
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
              >
                Mark all read
              </button>
            )}
            <button 
              onClick={clearAll}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error/10 text-on-surface-variant/40 hover:text-error transition-colors"
              title="Clear all"
            >
              <span className="material-symbols-outlined text-xl">delete_sweep</span>
            </button>
          </div>
        </div>

        {/* Filters Scrollable */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 -mx-6 px-6">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            const count = f.id === 'unread' ? unreadCount : 0;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-2xl whitespace-nowrap text-sm font-bold transition-all
                  ${isActive 
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-105' 
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}
                `}
              >
                <span className="material-symbols-outlined text-[18px]">{f.icon}</span>
                {f.label}
                {count > 0 && <span className="opacity-50 text-[10px]">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* View Modes */}
        <div className="flex gap-1 mt-4 p-1 bg-surface-container-low rounded-xl w-fit">
          {([
            { id: "time", label: "Timeline", icon: "schedule" },
            { id: "deal", label: "Deals", icon: "handshake" },
            { id: "flat", label: "Flat", icon: "segment" },
          ] as const).map((mode) => (
            <button
              key={mode.id}
              onClick={() => setGroupMode(mode.id)}
              className={`
                flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all
                ${groupMode === mode.id 
                  ? 'bg-surface shadow-sm text-primary' 
                  : 'text-on-surface-variant/40 hover:text-on-surface-variant'}
              `}
            >
              <span className="material-symbols-outlined text-[16px]">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area with PullToRefresh */}
      <PullToRefresh onRefresh={refresh}>
        <div className="max-w-3xl mx-auto w-full min-h-[calc(100vh-250px)]">
          {renderContent()}
        </div>
      </PullToRefresh>
    </main>
  );
}

