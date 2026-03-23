"use client";

import { usePathname } from "next/navigation";
import React from "react";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Specific routes that demand a locked layout for custom internal scrolling (App Shell style)
  const isLockedRoute = pathname.startsWith("/messages") || pathname.startsWith("/dashboard");

  return (
    <main 
      className={`flex-1 flex flex-col w-full relative pt-16 md:pt-20 pb-20 md:pb-0 ${
        isLockedRoute ? "overflow-hidden" : "overflow-y-auto no-scrollbar"
      }`}
    >
      {children}
    </main>
  );
}
