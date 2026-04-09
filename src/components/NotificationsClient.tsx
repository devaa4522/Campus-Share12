"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  let interval = seconds / 31536000;
  if (interval >= 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval >= 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval >= 1) {
    const days = Math.floor(interval);
    return days === 1 ? "1 day ago" : days + " days ago";
  }
  interval = seconds / 3600;
  if (interval >= 1) {
    const hrs = Math.floor(interval);
    return hrs === 1 ? "1 hour ago" : hrs + " hours ago";
  }
  interval = seconds / 60;
  if (interval >= 1) {
    const mins = Math.floor(interval);
    return mins === 1 ? "1 min ago" : mins + " mins ago";
  }
  return "Just now";
}

export default function NotificationsClient({ initialNotifications }: { initialNotifications: Notification[] }) {
  const [filter, setFilter] = useState("All Updates");
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  
  const supabase = createClient();

  const handleClearArchive = async () => {
    if (notifications.length === 0) return;
    
    // Optimistic UI clear
    const backup = [...notifications];
    setNotifications([]);
    
    // Delete all notifications for this user from DB
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', notifications[0].user_id);

    if (error) {
      console.error('Failed to clear notifications:', error);
      // Rollback on error
      setNotifications(backup);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "All Updates") return true;
    if (filter === "Deal Updates") return n.type === "message" || n.type === "deal";
    if (filter === "System Alerts") return n.type === "system";
    if (filter === "Overdue") return n.type === "overdue";
    return true;
  });

  const getIconData = (type: string) => {
    switch (type) {
      case "overdue":
        return { icon: "warning", bg: "bg-error-container", textBg: "text-error", label: "Overdue Notices" };
      case "message":
      case "deal":
        return { icon: "handshake", bg: "bg-secondary-container", textBg: "text-secondary", label: "Deal Updates" };
      case "system":
      default:
        // Use primary-fixed styles for system alerts as per UI snippet
        return { icon: "info", bg: "bg-primary-fixed", textBg: "text-on-primary-fixed-variant", label: "System Alerts" };
    }
  };

  return (
    <main className="pt-24 pb-20 px-4 md:px-8 max-w-4xl mx-auto w-full">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div className="space-y-2">
          <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-primary-container mb-2">
            Activity Feed
          </h1>
          <p className="text-on-surface-variant font-body text-lg max-w-md">
            Your curated archive of academic exchanges and campus logistics.
          </p>
        </div>
        <button 
          onClick={handleClearArchive} 
          disabled={notifications.length === 0}
          className="group flex items-center space-x-2 px-6 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-full hover:bg-error hover:text-white transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="font-label text-sm font-semibold tracking-wide">
            {notifications.length === 0 ? 'Archive Empty' : 'Clear All Notifications'}
          </span>
          <span className="material-symbols-outlined text-sm">delete_sweep</span>
        </button>
      </div>

      {/* Bento Filter Tabs */}
      <div className="flex flex-wrap gap-3 mb-10">
        {["All Updates", "Deal Updates", "System Alerts", "Overdue"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all active:scale-95 ${
              filter === tab
                ? "bg-primary-container text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Notification List Section */}
      <div className="space-y-6">
        {filtered.length === 0 ? (
           <div className="text-center py-20 bg-surface-container-lowest rounded-xl border border-outline-variant/10 text-on-surface-variant">
             <span className="material-symbols-outlined text-4xl mb-2 opacity-50">all_inbox</span>
             <p>You have no new updates in this category.</p>
           </div>
        ) : (
          filtered.map((notification) => {
            const { icon, bg, textBg, label } = getIconData(notification.type);
            
            return (
              <div
                key={notification.id}
                className={`group relative bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(0,10,30,0.04)] transition-all hover:shadow-[0_12px_32px_rgba(0,10,30,0.08)] ${
                  notification.type === 'overdue' ? 'border-l-4 border-error' : ''
                } ${notification.is_read ? 'opacity-80' : ''}`}
              >
                <div className="flex items-start gap-5">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full ${bg} flex items-center justify-center`}>
                    <span 
                      className={`material-symbols-outlined ${notification.type === 'system' ? 'text-on-primary-fixed' : textBg}`} 
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {icon}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-bold tracking-widest uppercase ${textBg}`}>
                        {label}
                      </span>
                      <span className="text-xs text-on-surface-variant whitespace-nowrap ml-2">
                        {timeAgo(notification.created_at)}
                      </span>
                    </div>
                    <h3 className="font-headline text-lg font-bold text-primary-container leading-tight mb-2">
                      {notification.title}
                    </h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                      {notification.message}
                    </p>
                    
                    {/* Action buttons based on type */}
                    {notification.type === "overdue" && (
                      <button className="text-primary text-sm font-semibold hover:underline flex items-center gap-1">
                        Resolve Now
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    )}
                    {(notification.type === "deal" || notification.type === "message") && (
                      <Link
                        href="/messages"
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-container text-on-primary text-xs font-bold tracking-wide transition-transform active:scale-95"
                      >
                        GO TO MESSAGE CENTER
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination / Load More (Institutional Minimalist) */}
      {filtered.length > 5 && (
        <div className="mt-16 flex justify-center">
          <button className="px-8 py-3 rounded-full border border-outline-variant/30 text-primary font-semibold text-sm hover:bg-surface-container-low transition-colors active:scale-95">
            Load Archive Updates
          </button>
        </div>
      )}
    </main>
  );
}
