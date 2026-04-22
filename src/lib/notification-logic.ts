import { AppNotification, GroupedNotification } from "@/types/notifications";

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function groupByTime(notifications: AppNotification[]): [string, AppNotification[]][] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const groups: Record<string, AppNotification[]> = { Today: [], Yesterday: [], Earlier: [] };
  
  notifications.forEach((n) => {
    const t = new Date(n.created_at).getTime();
    if (t >= todayStart.getTime()) groups["Today"].push(n);
    else if (t >= yesterdayStart.getTime()) groups["Yesterday"].push(n);
    else groups["Earlier"].push(n);
  });
  
  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

export function groupByDeal(notifications: AppNotification[]): GroupedNotification[] {
  const dealMap: Record<string, AppNotification[]> = {};
  const standalone: AppNotification[] = [];

  notifications.forEach((n) => {
    const dealId = n.data?.deal_id;
    if (dealId && typeof dealId === 'string') {
      if (!dealMap[dealId]) dealMap[dealId] = [];
      dealMap[dealId].push(n);
    } else {
      standalone.push(n);
    }
  });

  const result: GroupedNotification[] = [];
  
  standalone.forEach((n) => result.push({ type: "single", notif: n }));
  
  Object.entries(dealMap).forEach(([deal_id, items]) => {
    if (items.length === 1) {
      result.push({ type: "single", notif: items[0] });
    } else {
      // Sort items within group by created_at descending
      const sortedItems = [...items].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      result.push({ 
        type: "group", 
        deal_id, 
        items: sortedItems, 
        latestAt: sortedItems[0].created_at 
      });
    }
  });

  return result.sort((a, b) => {
    const aTime = new Date(a.type === "single" ? a.notif.created_at : a.latestAt).getTime();
    const bTime = new Date(b.type === "single" ? b.notif.created_at : b.latestAt).getTime();
    return bTime - aTime;
  });
}
