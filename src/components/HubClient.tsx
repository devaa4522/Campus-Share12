"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import type { ItemWithProfile } from "@/lib/types";

export default function HubClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<ItemWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeDepartment, setActiveDepartment] = useState<string>("All");
  const [minKarma, setMinKarma] = useState<number>(0);
  const [isListView, setIsListView] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // We use profiles!inner so we can filter based on profile attributes
    let q = supabase
      .from("items")
      .select("id, user_id, title, description, category, condition, price_type, price_amount, status, images, created_at, college_domain, is_hidden, thumbnail_url, profiles!inner(id, full_name, karma_score, avatar_url, banned_until)")
      .eq("is_hidden", false)
      .neq("user_id", userId)
      .gte("profiles.karma_score", minKarma)
      .order("created_at", { ascending: false })
      .limit(50);

    if (query.trim()) {
      q = q.or(`title.ilike.%${query.trim()}%,description.ilike.%${query.trim()}%`);
    }

    if (activeDepartment !== "All") {
      q = q.eq("category", activeDepartment);
    }

    const { data } = await q;
    setItems((data ?? []) as unknown as ItemWithProfile[]);
    setLoading(false);
  }, [query, minKarma, activeDepartment, userId]);

  const visibleItems = useMemo(() => {
    if (!currentTime) return items;
    return items.filter((item) => {
      if (item.profiles?.banned_until) {
        const banStamp = new Date(item.profiles.banned_until).getTime();
        if (banStamp > currentTime) return false;
      }
      // Apply karma threshold client-side too, so slider feels instant
      if ((item.profiles?.karma_score ?? 0) < minKarma) return false;
      return true;
    });
  }, [items, currentTime, minKarma]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, 400);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  return (
    <div className="pt-8 pb-32 px-6 max-w-7xl mx-auto min-h-full font-body text-on-surface">
      {/* Refactored Header (The Compass) */}
      <header className="mb-12">
        <div className="bg-primary text-white rounded-xl p-10 relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-headline">The Hub</h1>
              <button
                onClick={() => router.push('/post')}
                className="flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/90 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>Add Item</span>
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-stretch">

              {/* Department Filter Dropdown */}
              <div className="relative min-w-55">
                <select
                  value={activeDepartment}
                  onChange={(e) => setActiveDepartment(e.target.value)}
                  className="w-full h-full pl-4 pr-10 py-4 bg-primary border border-white/20 rounded-xl focus:ring-2 focus:ring-secondary focus:bg-white/10 outline-none text-white cursor-pointer hover:bg-white/5 transition-all font-body text-sm font-semibold shadow-inner"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: 'none' }}
                >
                  <option className="text-white bg-primary font-sans" value="All">All Categories</option>
                  <option className="text-white bg-primary font-sans" value="Books">Books</option>
                  <option className="text-white bg-primary font-sans" value="Electronics">Electronics</option>
                  <option className="text-white bg-primary font-sans" value="Supplies">Supplies</option>
                  <option className="text-white bg-primary font-sans" value="Lab Gear">Lab Gear</option>
                  <option className="text-white bg-primary font-sans" value="Other">Other</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-white/50">expand_more</span>
                </div>
              </div>

              {/* Enhanced Search Bar */}
              <div className="relative flex-grow group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-white/50 group-focus-within:text-[#006e0c] transition-colors">search</span>
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchItems()}
                  className="block w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#006e0c] focus:bg-white/15 outline-none transition-all duration-300 text-lg placeholder:text-white/40 text-white shadow-sm font-body"
                  placeholder="Search journals, supplies, or scholars..."
                  type="text"
                />
              </div>
              <button
                type="button"
                onClick={fetchItems}
                className="px-8 py-4 bg-[#006e0c] hover:bg-[#006e0c]/90 text-white font-bold rounded-xl transition-all active:scale-95 font-body uppercase tracking-wider"
              >
                Search
              </button>
            </div>

            <p className="mt-4 text-xs text-white/40 font-medium tracking-wide flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              Displaying verified and active scholar listings only.
            </p>
          </div>

          {/* Background Decoration */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#006e0c]/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Filter Sidebar */}
        <aside className="lg:col-span-3 space-y-8 relative z-0">
          <section>
            <h3 className="font-headline text-xl mb-4 font-bold">Browse Categories</h3>
            <div className="flex flex-wrap gap-2">
              {['Books', 'Electronics', 'Supplies', 'Lab Gear', 'Other'].map(dept => {
                const isActive = activeDepartment === dept;
                return (
                  <button
                    key={dept}
                    onClick={() => setActiveDepartment(isActive ? 'All' : dept)}
                    className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors active:scale-95 ${isActive
                        ? 'border-[#006e0c] bg-[#006e0c]/10 text-[#006e0c]'
                        : 'border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant hover:border-[#006e0c] hover:text-[#006e0c]'
                      }`}
                  >
                    {dept}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline text-xl font-bold">Min. Karma</h3>
              <span className="text-[#006e0c] font-bold text-sm">{minKarma}+</span>
            </div>
            <input
              className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-[#006e0c]"
              max="1000" min="0" step="10" type="range"
              value={minKarma}
              onChange={(e) => setMinKarma(parseInt(e.target.value))}
            />
          </section>

          <section className="p-6 rounded-xl bg-[#000a1e] text-white shadow-lg border border-white/5">
            <h4 className="font-headline text-lg mb-2 font-bold">Academic Ledger</h4>
            <p className="text-sm opacity-70 mb-4 leading-relaxed">Exchange research credits for institutional access or mentorship.</p>
            <button onClick={() => router.push('/dashboard')} className="w-full py-3 bg-[#006e0c] rounded-lg font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity active:scale-95">
              View Wallet
            </button>
          </section>
        </aside>

        {/* Results Grid */}
        <div className="lg:col-span-9">
          <div className="flex items-baseline justify-between mb-8 border-b border-outline-variant/10 pb-4">
            <p className="text-on-surface-variant text-sm">
              <span className="font-bold text-[#000a1e]">{visibleItems.length}</span> active research match{visibleItems.length !== 1 ? 'es' : ''}
            </p>
            <div className="flex gap-2">
              <span onClick={() => setIsListView(false)} className={`material-symbols-outlined p-2 rounded-lg cursor-pointer active:scale-95 text-sm transition-colors ${!isListView ? 'bg-[#000a1e] text-white' : 'text-outline-variant hover:bg-surface-container-low'}`}>grid_view</span>
              <span onClick={() => setIsListView(true)} className={`material-symbols-outlined p-2 rounded-lg cursor-pointer active:scale-95 text-sm transition-colors ${isListView ? 'bg-[#000a1e] text-white' : 'text-outline-variant hover:bg-surface-container-low'}`}>list</span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-container-lowest rounded-xl p-6 animate-pulse">
                  <div className="aspect-video w-full rounded-lg mb-4 bg-surface-container-high" />
                  <div className="h-4 bg-surface-container-high rounded w-1/3 mb-3" />
                  <div className="h-6 bg-surface-container-high rounded w-3/4 mb-2" />
                </div>
              ))}
            </div>
          ) : visibleItems.length > 0 ? (
            <div className={isListView ? "flex flex-col gap-4" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"}>
              {visibleItems.map((item, index) => {
                // Determine Department Badge
                let matchedDept = "General";
                const checkBlock = [item.category, item.title].join(' ').toLowerCase();
                if (checkBlock.includes('engineering') || checkBlock.includes('math') || checkBlock.includes('tool')) matchedDept = "Engineering";
                else if (checkBlock.includes('medical') || checkBlock.includes('bio') || checkBlock.includes('health')) matchedDept = "Medical";
                else if (checkBlock.includes('art') || checkBlock.includes('design') || checkBlock.includes('paint')) matchedDept = "Arts";
                else if (checkBlock.includes('science') || checkBlock.includes('chemistry') || checkBlock.includes('physics')) matchedDept = "Science";

                // Derive a real trust score from karma (0–2000 range → 0–100%)
                const karmaScore = item.profiles?.karma_score ?? 0;
                const trustScore = Math.min(100, Math.round((karmaScore / 2000) * 100));

                return (
                  <div key={item.id} onClick={() => router.push(`/items/${item.id}`)} className={`group bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/20 hover:border-[#006e0c]/50 transition-all duration-300 shadow-sm hover:shadow-xl cursor-pointer flex ${isListView ? 'flex-row items-stretch gap-6' : 'flex-col'}`}>
                    <div className={`relative rounded-lg bg-surface-container-low overflow-hidden ${isListView ? 'w-32 md:w-48 h-32 md:h-48 shrink-0' : 'aspect-[4/3] w-full mb-4'}`}>
                      {item.images && item.images[0] ? (
                        <Image 
                          src={item.images[0]} 
                          alt={item.title} 
                          fill 
                          className="object-cover group-hover:scale-105 transition-transform duration-700" 
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          priority={index < 4}
                          loading={index < 4 ? "eager" : "lazy"}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container min-h-[120px]">
                          <span className="material-symbols-outlined text-4xl text-outline-variant">image</span>
                        </div>
                      )}
                      {!isListView && (
                        <>
                          <div className="absolute top-2 left-2 flex gap-1.5 z-10">
                            <span className="px-2 py-1 bg-[#000a1e]/90 text-white text-[10px] font-bold uppercase tracking-wider rounded backdrop-blur-md">{matchedDept}</span>
                          </div>
                          <div className="absolute top-2 right-2 z-10">
                            <span className="px-2 py-1 bg-white/95 text-[#000a1e] text-[10px] font-black rounded shadow-sm flex items-center gap-1">⭐ {trustScore}% Trust</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className={`flex-1 min-w-0 flex flex-col ${isListView ? 'justify-between py-1' : ''}`}>
                      <div>
                        {isListView && (
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-[#000a1e]/90 text-white text-[10px] font-bold uppercase tracking-wider rounded backdrop-blur-md">{matchedDept}</span>
                            <span className="px-2 py-1 bg-[#006e0c]/10 text-[#006e0c] text-[10px] font-black rounded shadow-sm flex items-center gap-1">⭐ {trustScore}% Trust</span>
                          </div>
                        )}
                        <h4 className="font-headline text-lg font-bold mb-2 group-hover:text-[#006e0c] transition-colors leading-snug truncate">{item.title}</h4>
                        <p className={`text-on-surface-variant text-sm leading-relaxed ${isListView ? 'line-clamp-2 mb-0' : 'mb-4 line-clamp-2'}`}>{item.description}</p>
                      </div>

                      <div className={`flex items-center justify-between border-outline-variant/10 ${isListView ? 'pt-3 mt-3 border-t' : 'pt-4 mt-auto border-t'}`}>
                        <div className="flex items-center gap-2">
                          {item.profiles?.avatar_url ? (
                            <Image 
                              src={item.profiles.avatar_url} 
                              alt="Portrait" 
                              width={32} 
                              height={32} 
                              className="w-8 h-8 rounded-full object-cover ring-2 ring-surface-container-low" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-surface-container-low">
                              <span className="material-symbols-outlined text-[16px]">person</span>
                            </div>
                          )}
                          <span className="text-xs font-semibold text-[#000a1e] truncate max-w-[100px]">{item.profiles?.full_name?.split(' ')[0] || "Scholar"}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#006e0c] bg-[#006e0c]/5 px-2 py-1 rounded">{item.profiles?.karma_score || 0} Karma</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-12 text-center py-10 border-2 border-dashed border-outline-variant/10 rounded-2xl">
              <span className="material-symbols-outlined text-4xl text-outline-variant mb-2">visibility_off</span>
              <p className="text-on-surface-variant text-sm font-medium">No results found, or items from restricted/shadowbanned users are hidden from public view.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
