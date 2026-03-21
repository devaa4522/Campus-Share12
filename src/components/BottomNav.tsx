"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Hub", icon: "grid_view" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/post", label: "Post", icon: "add_circle" },
  { href: "/tasks", label: "Tasks", icon: "task_alt" },
  { href: "/dashboard", label: "Activity", icon: "explore" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-white/85 dark:bg-[#000a1e]/85 backdrop-blur-xl shadow-[0px_-4px_16px_rgba(0,10,30,0.04)] rounded-t-xl pb-safe">
      <div className="flex justify-around items-center h-16 px-4 max-w-7xl mx-auto w-full">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full transition-all active:bg-slate-100 dark:active:bg-slate-800 ${
                isActive
                  ? "text-[#006e0c] relative after:content-[''] after:w-1 after:h-1 after:bg-[#006e0c] after:rounded-full after:mt-1"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <span
                className={`material-symbols-outlined ${item.href === "/post" ? "text-3xl" : ""}`}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
