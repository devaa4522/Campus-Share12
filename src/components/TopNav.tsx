import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import TopNavLinks from "./TopNavLinks";

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
    <nav className="fixed top-0 w-full z-50 bg-slate-50/85 backdrop-blur-xl shadow-sm">
      <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
        {/* Brand */}
        <Link
          href="/"
          className="font-headline text-2xl font-bold tracking-tighter text-primary"
        >
          Campus Share
        </Link>

        {/* Desktop Nav Links */}
        <TopNavLinks />

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {user && profile ? (
            <>
              <button className="material-symbols-outlined text-slate-500 hover:text-secondary transition-colors">
                notifications
              </button>
              {/* Karma Badge */}
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-secondary/10 text-secondary rounded-full">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
                </svg>
                {profile.karma_score ?? 0}
              </span>
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
