"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function KarmaBadgeClient({ initialKarma, userId }: { initialKarma: number; userId: string }) {
  const [karma, setKarma] = useState(initialKarma);

  useEffect(() => {
    // Initial Sync
    setKarma(initialKarma);

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
  }, [initialKarma, userId]);

  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-secondary/10 text-secondary rounded-full">
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
      </svg>
      {Math.floor(karma)} CP
    </span>
  );
}
