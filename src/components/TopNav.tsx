import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/server";
import TopNavLinks from "./TopNavLinks";
import { NotificationBell } from "./NotificationBell";
import KarmaBadgeClient from "./KarmaBadgeClient";

export default async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { full_name: string | null; karma_score: number | null; avatar_url: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, karma_score, avatar_url")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#000a1e] dark:bg-[#000a1e] shadow-[0px_12px_32px_rgba(0,10,30,0.06)] h-16 md:h-20 flex items-center">
      <div className="flex justify-between items-center px-6 md:px-8 w-full max-w-7xl mx-auto">
        <div className="flex-1">
          <Link
            href="/"
            className="font-headline text-2xl font-bold tracking-tighter whitespace-nowrap text-white"
          >
            Campus Share
          </Link>
        </div>

        {/* Desktop Nav Links */}
        <div className="flex-1 flex justify-center hidden md:flex">
          <TopNavLinks />
        </div>

        {/* Right Side */}
        <div className="flex-1 flex justify-end items-center gap-5 text-white">
          {user && profile ? (
            <>
              <div className="flex items-center gap-3">
                <Link href="/messages" className="hover:bg-white/10 p-2 rounded-full transition-all duration-200 scale-95 active:scale-90 relative flex items-center justify-center">
                  <span className="material-symbols-outlined">mail</span>
                </Link>
                <NotificationBell />
              </div>
              <div className="flex items-center gap-3">
                {/* Karma Badge */}
                <KarmaBadgeClient initialKarma={profile.karma_score ?? 0} userId={user.id} />
                {/* Avatar */}
              <Link
                href="/profile"
                className="relative w-9 h-9 rounded-full bg-surface-container-highest overflow-hidden border-2 border-outline-variant/30 hover:border-secondary transition-colors flex items-center justify-center"
              >
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "User"}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-on-surface-variant">
                    {(profile.full_name ?? "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
