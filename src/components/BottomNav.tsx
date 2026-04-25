// src/components/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { t } from "@/lib/design/tokens";

const NAV_ITEMS = [
  { href: "/",         label: "Home",     icon: "grid_view"  },
  { href: "/hub",      label: "Hub",      icon: "search"     },
  { href: "/post",     label: "Post",     icon: "add_circle" },
  { href: "/tasks",    label: "Tasks",    icon: "task_alt"   },
  { href: "/dashboard",label: "Activity", icon: "explore"    },
] as const;

// Routes where BottomNav should never appear
const HIDDEN_ROUTES = [
  "/messages",
  "/notifications",
  "/onboarding",
];

export default function BottomNav() {
  const pathname   = usePathname();
  const [visible, setVisible]     = useState(true);
  const lastScroll = useRef(0);
  const ticking    = useRef(false);

  const isHidden = HIDDEN_ROUTES.some(r => pathname.startsWith(r));

  useEffect(() => {
    if (isHidden) return;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const current = window.scrollY;
        const delta   = current - lastScroll.current;

        if (delta > 8 && current > 80) {
          setVisible(false);
        } else if (delta < -8) {
          setVisible(true);
        }

        lastScroll.current = current;
        ticking.current    = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHidden]);


  if (isHidden) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 w-full z-50 transition-transform duration-300 ease-out"
      style={{
        transform:     visible ? "translateY(0)" : "translateY(100%)",
        background:    t.nav.bg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop:     `1px solid ${t.border}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow:     "0 -4px 24px rgba(0,10,30,0.05)",
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
              className="flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-xl transition-all active:scale-90"
              style={{
                color: isActive ? t.nav.active : t.nav.inactive,
              }}
            >
              <span
                className="material-symbols-outlined text-[24px]"
                style={{
                  fontVariationSettings: isActive
                    ? "'FILL' 1, 'wght' 600"
                    : "'FILL' 0, 'wght' 400",
                }}
              >
                {item.icon}
              </span>
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