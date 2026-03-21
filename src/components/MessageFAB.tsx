"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MessageFAB() {
  const pathname = usePathname();

  if (pathname.startsWith("/messages")) {
    return null;
  }

  return (
    <Link
        href="/messages"
        className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center text-on-primary shadow-[0_8px_24px_rgba(0,110,12,0.3)] active:scale-90 transition-all z-50 border-4 border-surface"
    >
        <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
        >
            chat
        </span>
    </Link>
  );
}
