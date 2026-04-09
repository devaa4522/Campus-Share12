"use client";

import { usePathname } from "next/navigation";
import React from "react";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLockedRoute = pathname.startsWith("/messages") || pathname.startsWith("/dashboard");

  if (isLockedRoute) {
    // For messages/dashboard: fixed layout that exactly fills the gap between TopNav and BottomNav.
    // TopNav is h-16 (64px) on mobile, h-20 (80px) on desktop.
    // BottomNav is ~84px on mobile, hidden on desktop.
    return (
      <main
        className="w-full overflow-hidden fixed left-0 right-0 bottom-0 md:bottom-0 top-16 md:top-20"
      >
        <div className="h-full w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full relative pt-16 md:pt-20 pb-24 md:pb-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 w-full">
        {children}
      </div>
    </main>
  );
}