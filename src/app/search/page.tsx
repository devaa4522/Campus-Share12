"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { ItemWithProfile } from "@/lib/types";
import ItemCard from "@/components/ItemCard";
import { CardGridSkeleton } from "@/components/boneyard/PageSkeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";

export default function SearchPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activePriceType, setActivePriceType] = useState<"All" | "Free" | "Rental" | "Karma">("All");
  const [activeCondition, setActiveCondition] = useState<string>("All");
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const showResultsSkeleton = useDelayedLoading(loading, 180);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      setAuthed(true);
    });
  }, [router]);

  const fetchItems = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    const supabase = createClient();
    // RLS automatically filters by college_domain
    let q = supabase
      .from("items")
      .select("*, profiles(*)")
      .eq("is_hidden", false)
      .neq("user_id", userId as string)
      .order("created_at", { ascending: false });

    if (activePriceType !== "All") {
      q = q.eq("price_type", activePriceType as "Free" | "Rental" | "Karma");
    }
    if (activeCondition !== "All") {
      q = q.eq("condition", activeCondition);
    }
    if (query.trim()) {
      q = q.ilike("title", `%${query.trim()}%`);
    }

    const { data } = await q;
    setItems((data ?? []) as unknown as ItemWithProfile[]);
    setLoading(false);
  }, [query, activePriceType, activeCondition, authed, userId]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  if (!authed) return null;

  return (
    <div className="px-6 max-w-7xl mx-auto min-h-full">
      {/* Header */}
      <header className="mb-12 pt-8">
        <div className="bg-surface-container-low rounded-xl p-8 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Discovery
            </h1>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-outline">search</span>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-none rounded-xl focus:ring-2 focus:ring-secondary/20 transition-all duration-300 text-lg placeholder:text-outline/50 shadow-sm"
                placeholder="Search items, tools, or resources..."
              />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-secondary/5 to-transparent pointer-events-none" />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Filter Sidebar */}
        <aside className="lg:col-span-3 space-y-8 relative z-20 bg-surface-container-low p-6 rounded-xl shadow-md border border-outline-variant/10">
          {/* Price Type */}
          <section>
            <h3 className="font-headline text-xl mb-4 text-on-surface">Price</h3>
            <div className="flex flex-wrap gap-2">
              {(["All", "Free", "Karma", "Rental"] as const).map((pt) => (
                <FilterChip
                  key={pt}
                  label={pt}
                  active={activePriceType === pt}
                  onClick={() => setActivePriceType(pt)}
                />
              ))}
            </div>
          </section>

          {/* Condition */}
          <section>
            <h3 className="font-headline text-xl mb-4 text-on-surface">Condition</h3>
            <div className="flex flex-wrap gap-2">
              {["All", "Like New", "Good", "Fair"].map((cond) => (
                <FilterChip
                  key={cond}
                  label={cond}
                  active={activeCondition === cond}
                  onClick={() => setActiveCondition(cond)}
                />
              ))}
            </div>
          </section>

          {/* Info CTA */}
          <section className="p-6 rounded-xl bg-primary text-on-primary">
            <h4 className="font-headline text-lg mb-2">Campus Network</h4>
            <p className="text-sm opacity-80 mb-4 font-body leading-relaxed">
              You&apos;re seeing items from your campus only. College-locked for your privacy.
            </p>
          </section>
        </aside>

        {/* Results Grid */}
        <div className="lg:col-span-9 relative z-10 pb-24">
          <div className="flex items-baseline justify-between mb-8 border-b border-outline-variant/10 pb-4">
            <p className="font-body text-outline text-sm">
              <span className="font-bold text-on-surface">{items.length}</span> results
              {query && ` for "${query}"`}
            </p>
          </div>

          {loading ? (
            showResultsSkeleton ? <CardGridSkeleton name="search-results-grid" /> : <div className="min-h-[360px]" />
          ) : items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-6xl text-outline-variant mb-4 block">
                search_off
              </span>
              <h3 className="font-headline text-2xl font-bold text-primary mb-2">No Results Found</h3>
              <p className="text-on-surface-variant">Try adjusting your filters or search query.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active
          ? "border border-secondary bg-secondary/10 text-secondary"
          : "border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant hover:border-outline"
      }`}
    >
      {label}
    </button>
  );
}
