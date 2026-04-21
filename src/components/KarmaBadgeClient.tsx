"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function KarmaBadgeClient({ initialKarma, userId }: { initialKarma: number; userId: string }) {
  const [karma, setKarma] = useState(initialKarma);

  useEffect(() => {
    // Sync local state if initialKarma changes from server
    setKarma(initialKarma);
  }, [initialKarma]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`karma-sync-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new && payload.new.karma_score !== undefined) {
             setKarma(payload.new.karma_score);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 bg-secondary/20 text-secondary rounded-lg border border-secondary/20 transition-all duration-300 hover:bg-secondary/30 select-none shadow-sm shadow-secondary/5 uppercase tracking-tighter">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
      </svg>
      {Math.floor(karma)} CP
    </span>
  );
}
