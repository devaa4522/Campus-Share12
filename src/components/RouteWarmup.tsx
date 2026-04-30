"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const WARM_ROUTES = [
  "/",
  "/hub",
  "/dashboard",
  "/tasks",
  "/messages",
  "/notifications",
  "/post",
  "/profile",
  "/search",
];

function runWhenIdle(callback: () => void) {
  if (typeof window === "undefined") return;

  const idle = window.requestIdleCallback;

  if (idle) {
    idle(callback, { timeout: 2500 });
    return;
  }

  window.setTimeout(callback, 800);
}

export function RouteWarmup() {
  const router = useRouter();

  useEffect(() => {
    runWhenIdle(() => {
      for (const route of WARM_ROUTES) {
        router.prefetch(route);
      }

      void import("@/components/MessageCenterClient");
      void import("@/components/NotificationsClient");
      void import("@/components/DashboardClient");
      void import("@/components/TasksClient");
      void import("@/components/ProfileClient");
    });
  }, [router]);

  return null;
}