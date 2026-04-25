// src/components/MainWrapper.tsx
"use client";

import { usePathname } from "next/navigation";
import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { applyTheme } from "@/lib/design/theme";

export default function MainWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const earnMode = useAppStore((state) => state.earnMode);

  // Apply design system theme on mount
  useEffect(() => {
    applyTheme();
  }, []);

  // Earn mode tactical theme
  useEffect(() => {
    if (earnMode) {
      document.body.classList.add("theme-tactical");
    } else {
      document.body.classList.remove("theme-tactical");
    }
  }, [earnMode]);

  // Messages need a fixed full-screen layout
  if (pathname.startsWith("/messages")) {
    return (
      <main className="fixed inset-0 pt-16 md:pt-20 overflow-hidden">
        <div className="h-full w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    );
  }

  // Dashboard also fixed
  if (pathname.startsWith("/dashboard")) {
    return (
      <main className="fixed inset-0 pt-16 md:pt-20 overflow-hidden">
        <div className="h-full w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    );
  }

  // All other routes — scrollable
  return (
    <main className="flex-1 w-full relative pt-16 md:pt-20 pb-24 md:pb-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 w-full">
        {children}
      </div>
    </main>
  );
}