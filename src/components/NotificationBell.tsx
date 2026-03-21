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
    <Link href="/notifications" className="relative hover:bg-white/10 p-2 rounded-full transition-all duration-200 scale-95 active:scale-90 flex items-center justify-center text-white block leading-none">
      <span className="material-symbols-outlined">notifications</span>
      {count > 0 && (
        <span className="absolute top-1 right-2 flex h-3 w-3 items-center justify-center rounded-full bg-error text-[8px] font-bold text-white shadow-sm ring-2 ring-[#000a1e]">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
