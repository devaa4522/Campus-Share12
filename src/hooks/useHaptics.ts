"use client";

import { useCallback } from "react";

export function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Ignore devices that don't support it or if blocked by browser policy
      }
    }
  }, []);

  return {
    heartbeat: () => vibrate([100, 30, 100]),
    tick: () => vibrate(10),
    error: () => vibrate([50, 100, 50]),
    success: () => vibrate([50, 50, 100]),
  };
}
