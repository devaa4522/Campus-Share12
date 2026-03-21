import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { ItemWithProfile } from "@/lib/types";
import ImageWithFallback from "@/components/ImageWithFallback";
import RequestButton from "@/components/RequestButton";

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

  const typedItem = item as ItemWithProfile;
  const profile = typedItem.profiles;

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
        <div className="lg:col-span-5 space-y-8">
          {/* Item Meta */}
          <section>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-4 uppercase tracking-widest">
              <span>{typedItem.category}</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className={typedItem.status === "available" ? "text-secondary" : "text-error"}>
                {typedItem.status === "available" ? "Available" : "Rented"}
              </span>
            </nav>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-primary mb-4 font-headline">
              {typedItem.title}
            </h1>
            <p className="text-on-surface-variant leading-relaxed mb-6 text-lg">
              {typedItem.description}
            </p>
            <div className="flex flex-wrap gap-3">
              {typedItem.condition && (
                <span className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface text-sm font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  {typedItem.condition}
                </span>
              )}
              <span className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface text-sm font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">sell</span>
                {typedItem.price_type === "Free"
                  ? "Free Exchange"
                  : `${typedItem.price_amount} Karma Rental`}
              </span>
            </div>
          </section>

          {/* Lender Trust Card */}
          {profile && (
            <div className="bg-surface-container-lowest rounded-xl p-8 editorial-shadow border border-outline-variant/10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2">
                    {profile.is_verified ? "Verified Lender" : "Lender"}
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight text-primary">
                    {profile.full_name ?? "Anonymous"}
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    {profile.major ?? "Undeclared"}, {profile.year_of_study ?? "Student"}
                  </p>
                </div>
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-surface-container-highest overflow-hidden border-2 border-surface-container-highest flex items-center justify-center">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name ?? ""}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-on-surface-variant">
                        {(profile.full_name ?? "?").charAt(0)}
                      </span>
                    )}
                  </div>
                  {profile.is_verified && (
                    <div className="absolute -bottom-1 -right-1 bg-secondary text-white rounded-full p-1 border-2 border-surface-container-lowest">
                      <span
                        className="material-symbols-outlined text-[12px] block"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        verified
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Karma Badge */}
              <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-xl border border-secondary/10">
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-widest mb-1">
                    Karma Score
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-secondary">
                      {profile.karma_score ?? 0}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className="material-symbols-outlined text-secondary text-3xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 py-4 border-b border-outline-variant/20">
              <span className="material-symbols-outlined text-on-surface-variant">security</span>
              <div>
                <h4 className="text-sm font-bold text-primary">Academic Integrity Protection</h4>
                <p className="text-xs text-on-surface-variant leading-tight">
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
