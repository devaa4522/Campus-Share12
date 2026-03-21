"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Hub", icon: "grid_view" },
  { href: "/tasks", label: "Tasks", icon: "assignment" },
  { href: "/post", label: "Create", icon: "add_circle" },
  { href: "/profile", label: "Profile", icon: "person" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-slate-50/85 backdrop-blur-xl flex justify-around items-center h-16 px-4 pb-safe border-t border-slate-200/30 shadow-[0_-4px_20px_rgba(0,10,30,0.04)] rounded-t-xl">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center transition-all active:scale-95 duration-200 ${
              isActive
                ? "text-secondary relative after:content-[''] after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-secondary after:rounded-full"
                : "text-slate-400 hover:text-primary"
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
    </nav>
  );
}
