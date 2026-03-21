import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import TopNavLinks from "./TopNavLinks";
import NotificationBell from "./NotificationBell";
import KarmaBadgeClient from "./KarmaBadgeClient";

export default async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { full_name: string | null; karma_score: number | null; avatar_url: string | null } | null = null;
  let unreadCount = 0;
  if (user) {
    const [profileRes, unreadRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, karma_score, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase.rpc("get_unread_notification_count")
    ]);
    profile = profileRes.data;
    unreadCount = unreadRes.data || 0;
  }

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#000a1e] dark:bg-[#000a1e] shadow-[0px_12px_32px_rgba(0,10,30,0.06)] h-16 md:h-20 flex items-center">
      <div className="flex justify-between items-center px-6 md:px-8 w-full max-w-7xl mx-auto">
        {/* Brand */}
        <Link
          href="/"
          className="font-headline text-2xl font-bold tracking-tighter whitespace-nowrap text-white"
        >
          Campus Share
        </Link>

        {/* Desktop Nav Links */}
        <TopNavLinks />

        {/* Right Side */}
        <div className="flex items-center gap-5 text-white">
          {user && profile ? (
            <>
              <Link href="/messages" className="hover:bg-white/10 p-2 rounded-full transition-all duration-200 scale-95 active:scale-90 relative flex items-center justify-center">
                <span className="material-symbols-outlined">mail</span>
              </Link>
              <NotificationBell initialCount={unreadCount} userId={user.id} />
              {/* Karma Badge */}
              <KarmaBadgeClient initialKarma={profile.karma_score ?? 0} userId={user.id} />
              {/* Avatar */}
              <Link
                href="/profile"
                className="w-9 h-9 rounded-full bg-surface-container-highest overflow-hidden border-2 border-outline-variant/30 hover:border-secondary transition-colors flex items-center justify-center"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-on-surface-variant">
                    {(profile.full_name ?? "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
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
