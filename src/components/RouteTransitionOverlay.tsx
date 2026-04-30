"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/boneyard/PageSkeletons";

type PageSkeletonVariant = React.ComponentProps<typeof PageSkeleton>["variant"];

type OverlayState = {
  href: string;
  name: string;
  variant?: PageSkeletonVariant;
};

function getSkeletonForPath(pathname: string): OverlayState {
  if (pathname.startsWith("/messages")) {
    return { href: pathname, name: "messages", variant: "messages" };
  }

  if (pathname.startsWith("/notifications")) {
    return { href: pathname, name: "notifications", variant: "notifications" };
  }

  if (pathname.startsWith("/dashboard")) {
    return { href: pathname, name: "dashboard", variant: "deals" };
  }

  if (pathname.startsWith("/post")) {
    return { href: pathname, name: "post", variant: "form" };
  }

  if (pathname.startsWith("/profile")) {
    return { href: pathname, name: "profile", variant: "profile" };
  }

  if (pathname.startsWith("/items/")) {
    return { href: pathname, name: "item-detail", variant: "item" };
  }

  if (pathname.startsWith("/login")) {
    return { href: pathname, name: "login", variant: "auth" };
  }

  if (pathname.startsWith("/onboarding")) {
    return { href: pathname, name: "onboarding", variant: "form" };
  }

  return { href: pathname, name: "feed" };
}

function isModifiedClick(event: MouseEvent) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

export function RouteTransitionOverlay() {
  const pathname = usePathname();
  const [pending, setPending] = useState<OverlayState | null>(null);

  // Hide overlay as soon as the route changes.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPending(null);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const nextUrl = new URL(anchor.href, window.location.href);

      if (nextUrl.origin !== window.location.origin) return;

      const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      const currentPath = `${window.location.pathname}${window.location.search}`;

      if (nextPath === currentPath) return;
      if (nextUrl.pathname.startsWith("/auth/")) return;
      if (nextUrl.pathname.startsWith("/boneyard-capture")) return;

      setPending(getSkeletonForPath(nextUrl.pathname));

      window.setTimeout(() => {
        setPending(null);
      }, 8000);
    };

    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="fixed left-0 right-0 top-16 bottom-0 md:top-20 z-40 bg-surface text-on-surface overflow-hidden">
      <PageSkeleton name={pending.name} variant={pending.variant} />
    </div>
  );
}