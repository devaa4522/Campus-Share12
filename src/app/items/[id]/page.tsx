import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import type { ItemWithProfile } from "@/lib/types";
import Image from "next/image";
import ImageWithFallback from "@/components/ImageWithFallback";
import RequestButton from "@/components/RequestButton";
import ReportAction from "@/components/ReportAction";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("items")
    .select("*, profiles(*)")
    .eq("id", id)
    .single();

  if (!item) return notFound();

  const typedItem = item as unknown as ItemWithProfile;
  const profile = typedItem.profiles;

  let tradeCount = 0;
  let trustScore = 98;
  if (profile) {
    tradeCount = Math.floor((profile.karma_score || 0) / 10);
    // Derived from karma: Base 70% + up to 30% from karma (cap at 1000 karma)
    trustScore = 70 + Math.min(30, Math.floor((profile.karma_score || 0) / 33.3));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-7xl mx-auto px-6 pt-8 pb-32">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Gallery */}
        <div className="lg:col-span-7">
          <div className="rounded-xl overflow-hidden relative aspect-[4/3] bg-surface-container-low">
            <ImageWithFallback
              src={typedItem.images?.[0]}
              alt={typedItem.title}
              category={typedItem.category}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute top-4 left-4 glass-effect bg-white/70 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase">
              {typedItem.status === "available" ? "Available" : "Rented"}
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="lg:col-span-5 space-y-6">
          <section>
            <nav className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant mb-4 uppercase tracking-widest">
              <span>{typedItem.category}</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className={typedItem.status === "available" ? "text-[#006e0c]" : "text-error"}>
                {typedItem.status === "available" ? "Available" : "Rented"}
              </span>
            </nav>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#000a1e] mb-4 font-headline leading-tight">
              {typedItem.title}
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed mb-6 font-normal">
              {typedItem.description}
            </p>
            <div className="flex flex-wrap gap-3">
              {typedItem.condition && (
                <span className="px-4 py-2 rounded-lg bg-surface-container-low text-[#000a1e] text-sm font-semibold flex items-center gap-2 border border-outline-variant/10">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  {typedItem.condition}
                </span>
              )}
              <span className="px-4 py-2 rounded-lg bg-surface-container-low text-[#000a1e] text-sm font-semibold flex items-center gap-2 border border-outline-variant/10">
                <span className="material-symbols-outlined text-sm">sell</span>
                {typedItem.price_type === "Free"
                  ? "Free Exchange"
                  : `${typedItem.price_amount} Karma Rental`}
              </span>
            </div>
          </section>

          {/* Detailed Lender Verification Card */}
          {profile && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_8px_24px_rgba(0,10,30,0.04)] border border-outline-variant/20">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4">
                  <div className="relative">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.full_name ?? ""}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-full object-cover border-2 border-surface-container-highest"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-surface-container-highest border-2 border-surface-container-highest flex items-center justify-center">
                        <span className="text-xl font-bold text-on-surface-variant">
                          {(profile.full_name ?? "?").charAt(0)}
                        </span>
                      </div>
                    )}
                    {profile.is_verified && (
                      <div className="absolute -bottom-1 -right-1 bg-[#006e0c] text-white rounded-full p-0.5 border-2 border-white">
                        <span
                          className="material-symbols-outlined text-[10px] block"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          verified
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-0.5">
                      {profile.is_verified ? "Verified Lender" : "Lender"}
                    </p>
                    <h3 className="text-xl font-bold tracking-tight text-[#000a1e]">
                      {profile.full_name ?? "Anonymous"}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {profile.department ?? profile.major ?? "Scholar"}, {profile.year_of_study ?? "Student"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lender Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-[#006e0c]/10 border border-[#006e0c]/20 p-3 rounded-lg flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-[#006e0c] uppercase tracking-widest mb-1">Trust Score</p>
                    <div className="flex items-baseline gap-1">
                       <span className="text-2xl font-black text-[#006e0c]">{trustScore}%</span>
                    </div>
                 </div>
                 <div className="bg-[#000a1e]/5 border border-[#000a1e]/10 p-3 rounded-lg flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-[#000a1e] uppercase tracking-widest mb-1">Trade Count</p>
                    <div className="flex items-baseline gap-1">
                       <span className="text-2xl font-black text-[#000a1e]">{tradeCount}</span>
                       <span className="text-[10px] font-bold text-[#000a1e]/60 uppercase">Trades</span>
                    </div>
                 </div>
              </div>

              {/* Karma Score Banner */}
              <div className="flex items-center justify-between p-4 bg-[#006e0c]/5 rounded-xl border border-[#006e0c]/10">
                <div>
                  <p className="text-xs font-semibold text-[#006e0c] uppercase tracking-widest mb-1">
                    Karma Score
                  </p>
                  <div className="flex items-baseline gap-1 text-[#006e0c]">
                    <span className="text-2xl font-black">
                      {profile.karma_score ?? 0}
                    </span>
                    <span className="text-[10px] font-medium opacity-60">/ 1000</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className="material-symbols-outlined text-[#006e0c] text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span className="text-[9px] font-bold text-[#006e0c] uppercase tracking-tighter">
                    {profile.karma_score && profile.karma_score >= 800 ? "Top 1% Peer" : "Active Peer"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Reporting & Security */}
          <div className="space-y-3">
             {profile && (
               <ReportAction targetUserId={profile.id} itemId={typedItem.id} />
             )}
             
            <div className="flex items-center gap-4 py-3 border-t border-outline-variant/10 mt-4 pt-4">
              <span className="material-symbols-outlined text-on-surface-variant">security</span>
              <div>
                <h4 className="text-xs font-bold text-[#000a1e]">Academic Integrity Protection</h4>
                <p className="text-[11px] text-on-surface-variant leading-tight">
                  Borrowing is logged via campus credentials for safe return.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action */}
      <div className="fixed bottom-24 md:bottom-8 left-0 w-full px-6 md:flex md:justify-center pointer-events-none z-40">
        <div className="max-w-7xl mx-auto w-full flex justify-end pointer-events-auto">
          <RequestButton isLoggedIn={!!user} itemId={typedItem.id} />
        </div>
      </div>
    </div>
  );
}
