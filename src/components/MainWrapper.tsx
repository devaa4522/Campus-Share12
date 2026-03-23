"use client";

import { usePathname } from "next/navigation";
import React from "react";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLockedRoute = pathname.startsWith("/messages") || pathname.startsWith("/dashboard");

  return (
    <main 
      className={`flex-1 w-full relative pt-16 pb-24 ${
        isLockedRoute ? "overflow-hidden" : "overflow-y-auto"
      }`}
      /* This style ensures the main area is exactly the space between navs */
      style={{ height: 'calc(100dvh - 64px)' }} 
    >
      <div className="max-w-7xl mx-auto px-4 w-full">
         {children}
      </div>
    </main>
  );
}