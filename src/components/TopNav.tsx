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
    <nav className="fixed top-0 w-full z-50 bg-[#000a1e] border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.3)] h-16 md:h-20 flex items-center transition-all duration-300">
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
              <div className="flex items-center gap-2">
                <Link 
                  href="/messages" 
                  className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:text-white hover:bg-white/10 transition-all duration-300 active:scale-95"
                >
                  <span className="material-symbols-outlined text-2xl">mail</span>
                </Link>
                <NotificationBell />
              </div>
              <div className="flex items-center gap-4 pl-2 border-l border-white/10">
                {/* Karma Badge */}
                <KarmaBadgeClient initialKarma={profile.karma_score ?? 0} userId={user.id} />
                {/* Avatar */}
              <Link
                href="/profile"
                className="relative w-10 h-10 rounded-full bg-white/5 overflow-hidden border border-white/10 hover:border-secondary/50 transition-all duration-300 flex items-center justify-center group shadow-inner"
              >
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "User"}
                    fill
                    sizes="40px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <span className="text-sm font-bold text-white/70 group-hover:text-white transition-colors">
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
