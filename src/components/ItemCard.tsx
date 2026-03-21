import Link from "next/link";
import type { ItemWithProfile } from "@/lib/types";
import ImageWithFallback from "@/components/ImageWithFallback";

export default function ItemCard({ item }: { item: ItemWithProfile }) {
  const profile = item.profiles;

  return (
    <Link
      href={`/items/${item.id}`}
      className="group bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/20 hover:border-secondary transition-all duration-300 block"
    >
      {/* Image */}
      <div className="aspect-video w-full rounded-lg mb-4 bg-surface-container-low overflow-hidden relative">
        <ImageWithFallback
          src={item.images?.[0]}
          alt={item.title}
          category={item.category}
          fill
          className="object-cover"
        />
      </div>

      {/* Category + Status */}
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] uppercase tracking-widest font-bold text-secondary">
          {item.category}
        </span>
        <span
          className={`text-[10px] uppercase tracking-tighter font-bold ${
            item.status === "available" ? "text-secondary" : "text-error"
          }`}
        >
          {item.status === "available" ? "Available" : "Rented"}
        </span>
      </div>

      {/* Title + Description */}
      <h4 className="font-headline text-xl mb-2 group-hover:text-secondary transition-colors leading-snug">
        {item.title}
      </h4>
      <p className="text-on-surface-variant text-sm mb-6 line-clamp-2">
        {item.description}
      </p>

      {/* Footer: User + Price */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden flex items-center justify-center">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name ?? ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-on-surface-variant">
                {(profile?.full_name ?? "?").charAt(0)}
              </span>
            )}
          </div>
          <span className="text-xs font-medium">
            {profile?.full_name ?? "Anonymous"}
          </span>
        </div>
        <span className="text-xs font-bold px-2 py-1 bg-surface-container-low rounded">
          {item.price_type === "Free"
            ? "Free"
            : `${item.price_amount ?? 0} Karma`}
        </span>
      </div>
    </Link>
  );
}
