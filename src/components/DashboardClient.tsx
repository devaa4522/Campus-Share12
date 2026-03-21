"use client";

import { useState } from "react";
import type { Item, Profile } from "@/lib/types";

type FilterTab = "All" | "available" | "rented";

export default function DashboardClient({
  profile,
  items,
}: {
  profile: Profile;
  items: Item[];
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  const filtered =
    activeTab === "All" ? items : items.filter((i) => i.status === activeTab);

  const availableCount = items.filter((i) => i.status === "available").length;
  const rentedCount = items.filter((i) => i.status === "rented").length;

  return (
    <div className="px-6 max-w-7xl mx-auto min-h-screen pt-8">
      {/* Header */}
      <section className="mb-10">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary-container mb-2">
          My Activity
        </h1>
        <p className="font-body text-on-surface-variant opacity-80">
          Track your scholarly contributions and active academic resources.
        </p>
      </section>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Karma Analytics */}
        <div className="col-span-12 lg:col-span-4 glass-card p-8 rounded-xl flex flex-col justify-between border border-white/20 editorial-shadow">
          <div>
            <h3 className="font-headline text-lg font-bold mb-1">Scholar Karma</h3>
            <p className="text-3xl font-bold text-primary-container">
              {profile.karma_score ?? 0}{" "}
              <span className="text-secondary text-sm font-body font-normal">
                active
              </span>
            </p>
          </div>
          <div className="mt-8">
            <div className="flex justify-between items-center text-xs opacity-70 font-semibold uppercase tracking-wider mb-2">
              <span>Trust Impact</span>
              <span>{Math.min(100, Math.round(((profile.karma_score ?? 0) / 2000) * 100))}%</span>
            </div>
            <div className="w-full bg-primary-container/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary-container h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(5, ((profile.karma_score ?? 0) / 2000) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Active Lends */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-primary-container text-white p-8 rounded-xl flex items-center justify-between">
          <div>
            <p className="font-label text-xs uppercase tracking-widest opacity-70 mb-2">
              Active Listings
            </p>
            <p className="font-headline text-3xl font-bold">{availableCount} Items</p>
            <p className="text-sm opacity-80 mt-1">Currently available</p>
          </div>
          <div className="p-4 bg-white/10 rounded-full">
            <span className="material-symbols-outlined text-4xl">outgoing_mail</span>
          </div>
        </div>

        {/* Active Borrows */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-surface-container-highest p-8 rounded-xl flex items-center justify-between">
          <div>
            <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-2">
              Rented Out
            </p>
            <p className="font-headline text-3xl font-bold text-primary-container">
              {String(rentedCount).padStart(2, "0")} Items
            </p>
            <p className="text-sm text-on-surface-variant mt-1">Currently borrowed</p>
          </div>
          <div className="p-4 bg-primary-container/5 rounded-full">
            <span className="material-symbols-outlined text-4xl text-primary-container">
              move_to_inbox
            </span>
          </div>
        </div>

        {/* Items List */}
        <div className="col-span-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline text-2xl font-bold">Your Listings</h2>
            <div className="flex gap-2">
              {(["All", "available", "rented"] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-secondary/10 text-secondary border border-secondary"
                      : "bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:border-outline"
                  }`}
                >
                  {tab === "All" ? "All" : tab === "available" ? "Available" : "Rented"}
                </button>
              ))}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="space-y-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`bg-surface-container-lowest p-6 rounded-xl shadow-sm flex justify-between items-start ${
                    item.status === "rented"
                      ? "border-l-4 border-secondary"
                      : "border border-outline-variant/30"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-surface-container-low rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary-container">
                        {item.category === "Medical"
                          ? "medical_services"
                          : item.category === "Engineering"
                          ? "architecture"
                          : item.category === "Arts"
                          ? "palette"
                          : "science"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-primary-container">{item.title}</h4>
                      <p className="text-sm text-on-surface-variant">
                        {item.category} · {item.condition}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-tighter ${
                        item.status === "available"
                          ? "bg-secondary/10 text-secondary"
                          : "bg-primary-container/10 text-primary-container"
                      }`}
                    >
                      {item.status}
                    </span>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {item.price_type === "Free"
                        ? "Free"
                        : `${item.price_amount} Karma`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-xl p-10 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant mb-3 block">
                inventory_2
              </span>
              <p className="text-on-surface-variant">
                {activeTab === "All"
                  ? "No items yet. Create your first listing!"
                  : `No ${activeTab} items.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
