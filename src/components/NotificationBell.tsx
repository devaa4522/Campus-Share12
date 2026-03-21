"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function NotificationBell({ initialCount, userId }: { initialCount: number, userId: string }) {
  const [count, setCount] = useState(initialCount);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        async () => {
          const { data } = await supabase.rpc("get_unread_notification_count");
          if (data !== null) {
            setCount(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  return (
    <Link href="/notifications" className="relative material-symbols-outlined text-slate-500 hover:text-secondary transition-colors block leading-none">
      notifications
      {count > 0 && (
        <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
