import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import type { ItemWithProfile } from "@/lib/types";
import ItemCard from "@/components/ItemCard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let featuredItems: ItemWithProfile[] = [];

  if (user) {
    // College-isolated: only show items from same college_domain (via RLS)
    const { data: items } = await supabase
      .from("items")
      .select("*, profiles(*)")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(6);
    featuredItems = (items ?? []) as ItemWithProfile[];
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative mb-12 rounded-[2rem] overflow-hidden min-h-[420px] flex flex-col justify-center items-center text-center px-6 mx-4 md:mx-6 mt-8"
        style={{ background: "linear-gradient(to bottom right, #000a1e, #0f1c30)" }}
      >
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-5xl md:text-7xl font-headline font-bold text-white mb-6 tracking-tight leading-tight">
            Share. Help. Thrive.
          </h1>
          <p className="text-on-primary-container text-lg md:text-xl font-body mb-8 max-w-lg mx-auto">
            Access the collective resources of your campus. Exchange tools, notes, and favors with your college mates.
          </p>

          {!user ? (
            <div className="glass-effect bg-white/10 border border-white/20 rounded-full px-8 py-4 inline-flex items-center gap-3 text-white">
              <span className="material-symbols-outlined text-secondary-fixed-dim">visibility</span>
              <span className="text-sm font-medium tracking-wide uppercase">
                Sign in to see your campus
              </span>
              <Link
                href="/login"
                className="ml-4 bg-white text-primary px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-100 transition-colors"
              >
                Join Now
              </Link>
            </div>
          ) : (
            <Link
              href="/post"
              className="inline-flex items-center gap-2 bg-secondary text-white px-10 py-4 rounded-full text-sm font-bold shadow-lg hover:opacity-90 transition-all"
            >
              <span className="material-symbols-outlined">add</span>
              Create New Listing
            </Link>
          )}
        </div>
      </section>

      {/* Items Grid */}
      {user ? (
        <section className="px-4 md:px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {featuredItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>

          {featuredItems.length === 0 && (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-6xl text-outline-variant mb-4 block">
                inventory_2
              </span>
              <h3 className="font-headline text-2xl font-bold text-primary mb-2">
                Your Campus Awaits
              </h3>
              <p className="text-on-surface-variant">
                No items from your college yet. Be the first to contribute!
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className="px-4 md:px-6 max-w-7xl mx-auto">
          {/* Features for guests */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 bg-surface-container-low rounded-xl space-y-4">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                security
              </span>
              <h3 className="font-headline text-lg font-bold">College-Locked</h3>
              <p className="text-sm text-on-surface-variant font-light">
                Only verified students from your institution can see and share resources. Your campus, your community.
              </p>
            </div>
            <div className="p-8 bg-surface-container-low rounded-xl space-y-4">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                volunteer_activism
              </span>
              <h3 className="font-headline text-lg font-bold">Karma Economy</h3>
              <p className="text-sm text-on-surface-variant font-light">
                Earn karma by sharing. Spend it to borrow. A self-sustaining cycle that rewards generosity.
              </p>
            </div>
            <div className="p-8 bg-surface-container-low rounded-xl space-y-4">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                assignment
              </span>
              <h3 className="font-headline text-lg font-bold">Task Marketplace</h3>
              <p className="text-sm text-on-surface-variant font-light">
                Need help with a campus errand? Post a task and let your peers come to the rescue.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* CTA Banner */}
      {user && (
        <section className="px-4 md:px-6 max-w-7xl mx-auto mt-12">
          <div className="p-10 bg-surface-container-low rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="md:max-w-md">
              <h2 className="font-headline text-3xl font-bold text-primary mb-3">
                Need a hand or a tool?
              </h2>
              <p className="text-on-surface-variant">
                Post a task to the marketplace and connect with peers instantly.
              </p>
            </div>
            <Link
              href="/tasks"
              className="bg-primary text-white px-10 py-4 rounded-full font-bold shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined">assignment</span>
              Browse Tasks
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
