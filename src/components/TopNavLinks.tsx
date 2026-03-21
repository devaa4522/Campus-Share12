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
            prefetch={true}
            className={`font-label text-sm transition-colors ${
              isActive 
                ? "text-white border-b-2 border-[#006e0c] pb-1 font-bold"
                : "text-slate-300 hover:text-white font-medium"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}