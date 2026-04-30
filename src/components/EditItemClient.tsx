"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Item } from "@/lib/types";
import Image from "next/image";
import toast from "react-hot-toast";

export default function EditItemClient({ item }: { item: Item }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || "");
  const [isHidden, setIsHidden] = useState(item.is_hidden || false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(item.thumbnail_url || item.images?.[0] || null);
  const [saving, setSaving] = useState(false);

  const hasUnsavedChanges = 
    title !== item.title || 
    description !== (item.description || "") || 
    isHidden !== (item.is_hidden || false) || 
    thumbnailUrl !== (item.thumbnail_url || item.images?.[0] || null);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_item", {
      p_item_id: item.id,
      p_title: title,
      p_description: description,
      p_is_hidden: isHidden,
      p_thumbnail_url: thumbnailUrl,
    });

    if (error) {
      console.error(error);
      toast.error("Failed to update item.");
    } else {
      toast.success("Item updated successfully!");
      router.refresh();
      router.prefetch("/dashboard");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-32">
      <div className="mb-10">
        <button onClick={() => router.back()} className="text-sm font-bold flex items-center gap-1 mb-4 text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined text-sm">arrow_back</span> Back
        </button>
        <span className="text-secondary font-medium tracking-widest text-[10px] uppercase">Management Console</span>
        <h2 className="font-headline text-4xl font-bold text-primary mt-2">Adjust Item Details</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Primary Details */}
        <div className="md:col-span-8 space-y-8">
          {/* Basic Info Card */}
          <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_12px_32px_rgba(0,10,30,0.04)] border border-outline-variant/10">
            <h3 className="font-headline text-xl mb-6 text-primary">Core Information</h3>
            <div className="space-y-6">
              <div className="group">
                <label className="block font-headline text-sm font-semibold mb-2 text-on-surface-variant">Item Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-lg p-4 text-on-surface focus:ring-1 focus:ring-primary outline-none transition-all" 
                />
              </div>
              <div className="group">
                <label className="block font-headline text-sm font-semibold mb-2 text-on-surface-variant">Description</label>
                <textarea 
                  rows={5} 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-lg p-4 text-on-surface focus:ring-1 focus:ring-primary outline-none transition-all resize-none" 
                />
              </div>
            </div>
          </section>

          {/* Photo Gallery Management */}
          <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_12px_32px_rgba(0,10,30,0.04)] border border-outline-variant/10">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="font-headline text-xl text-primary">Media Gallery</h3>
                <p className="text-sm text-on-surface-variant mt-1">Select an image to set it as the primary thumbnail.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {item.images?.map((url, i) => {
                const isThumbnail = thumbnailUrl === url;
                return (
                  <div 
                    key={i} 
                    onClick={() => setThumbnailUrl(url)}
                    className={`relative aspect-square rounded-lg overflow-hidden group cursor-pointer transition-all border-2 ${isThumbnail ? 'border-secondary' : 'border-transparent hover:border-outline-variant'}`}
                  >
                    <Image src={url} alt={`Preview ${i}`} fill sizes="(max-width: 768px) 50vw, 25vw" className={`object-cover transition-opacity ${isThumbnail ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`} />
                    {isThumbnail && (
                      <div className="absolute top-2 left-2 bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        Thumbnail
                      </div>
                    )}
                    {!isThumbnail && (
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(!item.images || item.images.length === 0) && (
              <p className="text-on-surface-variant">No images found for this item.</p>
            )}
          </section>
        </div>

        {/* Right Column: Metadata & Status */}
        <div className="md:col-span-4 space-y-8">
          {/* Visibility Status Card */}
          <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_12px_32px_rgba(0,10,30,0.04)] border border-outline-variant/10">
            <h3 className="font-headline text-lg mb-6 text-primary">Availability</h3>
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
              <div className="flex items-center gap-3">
                {!isHidden ? (
                  <div className="w-3 h-3 bg-secondary rounded-full animate-pulse"></div>
                ) : (
                  <div className="w-3 h-3 bg-outline rounded-full"></div>
                )}
                <span className="font-bold text-sm tracking-tight">{!isHidden ? "Live on Hub" : "Hidden"}</span>
              </div>
              
              {/* Toggle Switch */}
              <div className="relative inline-flex items-center cursor-pointer" onClick={() => setIsHidden(!isHidden)}>
                <div className={`w-11 h-6 rounded-full transition-all flex items-center ${!isHidden ? 'bg-secondary' : 'bg-surface-container-highest'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-all transform mx-[2px] shadow-sm ${!isHidden ? 'translate-x-full' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </div>
            
            <p className="mt-4 text-[11px] text-on-surface-variant leading-relaxed italic">
              &quot;Hidden&quot; items are only visible in your private dashboard and cannot be requested by other members.
            </p>
          </section>

          {/* Stats Card */}
          <div className="bg-primary p-8 rounded-xl text-white">
            <div className="flex items-center gap-4 mb-4">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
              <h4 className="font-headline text-sm font-bold uppercase tracking-widest">Pricing</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] opacity-60 font-bold uppercase">Type</p>
                <p className="text-xl font-headline mt-1">{item.price_type}</p>
              </div>
              {item.price_type !== "Free" && (
                <div>
                  <p className="text-[10px] opacity-60 font-bold uppercase">Amount</p>
                  <p className="text-xl font-headline mt-1">{item.price_amount}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Save Changes Bar */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 w-full z-40 px-6 py-6 pointer-events-none animate-in slide-in-from-bottom border-t border-transparent">
          <div className="max-w-4xl mx-auto w-full flex justify-between items-center bg-white/90 backdrop-blur-xl px-8 py-5 rounded-full shadow-[0px_20px_48px_rgba(0,10,30,0.15)] pointer-events-auto border border-white/40">
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Unsaved Changes Detected</p>
            </div>
            <div className="flex gap-4 w-full sm:w-auto">
              <button 
                onClick={() => {
                  setTitle(item.title);
                  setDescription(item.description || "");
                  setIsHidden(item.is_hidden || false);
                  setThumbnailUrl(item.thumbnail_url || item.images?.[0] || null);
                }}
                className="flex-1 sm:flex-none px-6 py-3 text-xs font-bold text-on-surface uppercase tracking-widest hover:bg-surface-container-low rounded-full transition-colors"
               >
                Discard
               </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none px-8 py-3 bg-gradient-to-r from-primary to-slate-800 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
