"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNavLinks() {
  const pathname = usePathname();
  
  const links = [
    { href: "/", label: "Hub" },
    { href: "/tasks", label: "Tasks" },
    { href: "/dashboard", label: "Activity" }
  ];

  return (
    <div className="hidden md:flex items-center space-x-8">
      {links.map(link => {
        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`font-serif tracking-tight text-lg transition-colors ${
              isActive 
                ? "text-emerald-700 dark:text-emerald-500 font-bold border-b-2 border-emerald-700 dark:border-emerald-500 pb-1"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
