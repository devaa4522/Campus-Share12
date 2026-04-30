// src/components/BottomNav.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/design/tokens";

const NAV_ITEMS = [
  { href: "/",          label: "Home",     icon: "/icons/home.png",     type: "image" },
  { href: "/hub",       label: "Hub",      icon: "search",              type: "material" },
  { href: "/post",      label: "Post",     icon: "/icons/post.png",     type: "image" },
  { href: "/tasks",     label: "Tasks",    icon: "task_alt",            type: "material" },
  { href: "/dashboard", label: "Activity", icon: "/icons/activity.png", type: "image" },
] as const;

  // { href: "/",          label: "Home",     icon: "home or grid_view"},
  // { href: "/hub",       label: "Hub",      icon: "search"     },
  // { href: "/post",      label: "Post",     icon: "add_circle" },
  // { href: "/tasks",     label: "Tasks",    icon: "task_alt"   },
  // { href: "/dashboard", label: "Activity", icon: "explore"    },
// Routes where BottomNav should never appear
const HIDDEN_ROUTES = [
  "/messages",
  "/notifications",
  "/onboarding",
];

export default function BottomNav() {
  const pathname = usePathname();

  const [visible, setVisible] = useState(true);
  const lastScroll = useRef(0);
  const ticking = useRef(false);

  const isHidden = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));

  // Reset nav visibility when route changes
// Reset nav visibility when route changes
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setVisible(true);
    });

    const dashboardScroll = document.getElementById("dashboard-scroll");

    if (pathname.startsWith("/dashboard") && dashboardScroll) {
      lastScroll.current = dashboardScroll.scrollTop;
    } else {
      lastScroll.current = window.scrollY;
    }

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    if (isHidden) return;

    const scrollEl =
      pathname.startsWith("/dashboard")
        ? document.getElementById("dashboard-scroll")
        : window;

    if (!scrollEl) return;

    const getScrollY = () => {
      if (scrollEl === window) {
        return window.scrollY;
      }

      return (scrollEl as HTMLElement).scrollTop;
    };

    lastScroll.current = getScrollY();

    const onScroll = () => {
      if (ticking.current) return;

      ticking.current = true;

      requestAnimationFrame(() => {
        const current = getScrollY();
        const delta = current - lastScroll.current;

        if (delta > 8 && current > 80) {
          setVisible(false);
        } else if (delta < -8) {
          setVisible(true);
        }

        lastScroll.current = current;
        ticking.current = false;
      });
    };

    scrollEl.addEventListener("scroll", onScroll as EventListener, {
      passive: true,
    });

    return () => {
      scrollEl.removeEventListener("scroll", onScroll as EventListener);
    };
  }, [isHidden, pathname]);

  const scrollCurrentPageToTop = () => {
  if (pathname.startsWith("/dashboard")) {
    const dashboardScroll = document.getElementById("dashboard-scroll");

    if (dashboardScroll) {
      dashboardScroll.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};
  if (isHidden) return null;


  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 w-full z-50 transition-transform duration-300 ease-out"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        background: t.nav.bg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: `1px solid ${t.border}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -4px 24px rgba(0,10,30,0.05)",
      }}
    >
      <div className="flex justify-around items-center h-16 px-2 max-w-7xl mx-auto w-full">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={(e) => {
                if (isActive) {
                  e.preventDefault();
                  scrollCurrentPageToTop();
                }
              }}
              className="relative flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-xl transition-all active:scale-90"
              style={{
                color: isActive ? t.nav.active : t.nav.inactive,
                
              }}
            >
              {item.type === "image" ? (
                <Image
                  src={item.icon}
                  alt=""
                  width={26}
                  height={26}
                  className="object-contain transition-all duration-200"
                  style={{
                    opacity: isActive ? 1 : 0.55,
                    transform: isActive ? "scale(1.08)" : "scale(1)",
                    filter: isActive ? "none" : "grayscale(1)",
                  }}
                />
              ) : (
                <span
                  className="material-symbols-outlined text-[24px] transition-all duration-200"
                  style={{
                    opacity: isActive ? 1 : 0.75,
                    transform: isActive ? "scale(1.08)" : "scale(1)",
                    fontVariationSettings: isActive
                      ? "'FILL' 1, 'wght' 600"
                      : "'FILL' 0, 'wght' 400",
                  }}
                >
                  {item.icon}
                </span>
              )}

              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                {item.label}
              </span>

              {/* Active dot */}
              {isActive && (
                <div
                  className="absolute bottom-1 w-1 h-1 rounded-full"
                  style={{ background: t.nav.active }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}