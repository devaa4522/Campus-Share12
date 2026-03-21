"use client";

import { useState } from "react";
import type { Item, Profile, ItemRequest } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import toast from "react-hot-toast";

type DealTab = "made" | "received" | "my_listings";

interface RequestWithRelations extends ItemRequest {
  items: (Item & { profiles?: Profile | null }) | null;
  profiles: Profile | null;
}

export default function DashboardClient({
  profile,
  items,
  madeRequests,
  receivedRequests,
}: {
  profile: Profile;
  items: Item[];
  madeRequests: any[];
  receivedRequests: any[];
}) {
  const [activeTab, setActiveTab] = useState<DealTab>("received");
  const [localMade, setLocalMade] = useState<RequestWithRelations[]>(madeRequests);
  const [localReceived, setLocalReceived] = useState<RequestWithRelations[]>(receivedRequests);

  const activeEarnings = items
    .filter((i) => i.status === "rented")
    .reduce((acc, curr) => acc + (curr.price_amount || 0), 0);

  const pendingReceivedCount = localReceived.filter(r => r.status === "pending").length;

  async function handleUpdateStatus(requestId: string, newStatus: "accepted" | "declined", itemId?: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("item_requests")
      .update({ status: newStatus })
      .eq("id", requestId);
      
    if (error) {
      toast.error("Failed to update deal status");
      return;
    }

    if (newStatus === "accepted" && itemId) {
      // Update item status to rented
      await supabase.from("items").update({ status: "rented" }).eq("id", itemId);
    }
    
    toast.success(`Deal ${newStatus}!`);
    
    // Optimistic UI
    setLocalReceived(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
  }

  const renderRequestCard = (req: RequestWithRelations, isLenderView: boolean) => {
    const otherPerson = isLenderView ? req.profiles : req.items?.profiles;
    const item = req.items;
    if (!item) return null;

    return (
      <div key={req.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_12px_32px_rgba(0,10,30,0.06)] border border-outline-variant/10 group hover:border-primary/20 transition-all duration-300">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-32 h-32 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 relative">
            {item.images?.[0] ? (
              <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-container text-on-surface-variant font-bold text-lg">
                No Image
              </div>
            )}
          </div>
          <div className="flex-grow">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold tracking-wider uppercase ${
                    req.status === 'pending' ? 'bg-surface-container-high text-on-surface-variant' :
                    req.status === 'accepted' ? 'bg-secondary-container text-on-secondary-container' :
                    'bg-error/10 text-error'
                  }`}>
                    {req.status}
                  </span>
                </div>
                <h3 className="font-headline text-xl font-bold text-primary">{item.title}</h3>
              </div>
            </div>
            
            <div className="flex items-center gap-4 py-4 mb-4 border-y border-outline-variant/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                   {otherPerson?.avatar_url ? (
                     <img src={otherPerson.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                     <span className="font-bold">
                       {otherPerson?.full_name?.charAt(0) || "?"}
                     </span>
                   )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">{otherPerson?.full_name || "Unknown User"}</p>
                  <p className="text-xs text-on-surface-variant">{otherPerson?.department || "Student"}</p>
                </div>
              </div>
              <div className="h-8 w-[1px] bg-outline-variant/30"></div>
              <div>
                <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest">Duration</p>
                <p className="text-sm font-medium">{req.duration_days} Days</p>
              </div>
            </div>

            <div className="flex gap-3">
              {isLenderView && req.status === "pending" ? (
                <>
                  <button 
                    onClick={() => handleUpdateStatus(req.id, "accepted", item.id)}
                    className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-900 transition-all active:scale-95">
                    Accept Deal
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(req.id, "declined")}
                    className="border border-outline-variant/30 text-on-surface-variant px-6 py-2.5 rounded-lg font-bold text-sm hover:border-primary hover:text-primary transition-all active:scale-95">
                    Decline
                  </button>
                </>
              ) : (
                <button className="text-secondary font-bold text-sm flex items-center gap-1 hover:underline">
                    View Details <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-6 max-w-7xl mx-auto min-h-screen pt-8">
      {/* Editorial Header */}
      <header className="mb-10">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary mb-2">Deal Manager</h1>
        <p className="text-on-surface-variant font-body text-lg">Curating the circular economy of your campus community.</p>
      </header>

      {/* Bento Layout for Tabs */}
      <div className="flex flex-col gap-8">
        
        {/* Tab Navigation */}
        <div className="flex gap-12 border-b border-outline-variant/20 mb-2 overflow-x-auto whitespace-nowrap">
          <button 
            onClick={() => setActiveTab("made")}
            className={`pb-4 tracking-tight transition-colors relative ${activeTab === "made" ? "text-primary font-bold border-b-2 border-primary" : "text-on-surface-variant font-medium hover:text-primary"}`}
          >
            Requests I've Made
          </button>
          <button 
            onClick={() => setActiveTab("received")}
            className={`pb-4 tracking-tight transition-colors relative ${activeTab === "received" ? "text-primary font-bold border-b-2 border-primary" : "text-on-surface-variant font-medium hover:text-primary"}`}
          >
            Requests for my Items
            {pendingReceivedCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-secondary-container text-on-secondary-container text-xs rounded-full">
                {pendingReceivedCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab("my_listings")}
            className={`pb-4 tracking-tight transition-colors relative ${activeTab === "my_listings" ? "text-primary font-bold border-b-2 border-primary" : "text-on-surface-variant font-medium hover:text-primary"}`}
          >
            My Listings
            <span className="ml-2 px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-xs rounded-full">
              {items.length}
            </span>
          </button>
        </div>

        {/* View Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24">
          
          {/* Left / Main Column: Request Cards */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {activeTab === "my_listings" ? (
              items.length > 0 ? (
                items.map(item => (
                  <div key={item.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10 flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-32 h-32 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 relative">
                      {(item.thumbnail_url || item.images?.[0]) ? (
                        <img src={item.thumbnail_url || item.images![0]} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container text-on-surface-variant font-bold text-lg">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between">
                          <h3 className="font-headline text-xl font-bold text-primary">{item.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${item.is_hidden ? 'bg-surface-container-highest' : 'bg-secondary/10 text-secondary'}`}>
                            {item.is_hidden ? 'Hidden' : 'Live'}
                          </span>
                        </div>
                        <p className="text-sm text-on-surface-variant mt-2 line-clamp-2">{item.description}</p>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <Link href={`/items/${item.id}/edit`} className="bg-primary text-white px-6 py-2 rounded-lg font-bold text-sm tracking-widest uppercase hover:bg-slate-800 transition-colors">
                          Edit Listing
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-on-surface-variant border-2 border-dashed border-outline-variant/30 rounded-xl">
                  You don't have any listings yet.
                </div>
              )
            ) : activeTab === "received" ? (
              localReceived.length > 0 ? (
                localReceived.map(req => renderRequestCard(req, true))
              ) : (
                <div className="text-center py-12 text-on-surface-variant border-2 border-dashed border-outline-variant/30 rounded-xl">
                  No requests received yet.
                </div>
              )
            ) : (
              localMade.length > 0 ? (
                localMade.map(req => renderRequestCard(req, false))
              ) : (
                <div className="text-center py-12 text-on-surface-variant border-2 border-dashed border-outline-variant/30 rounded-xl">
                  You haven't made any requests yet.
                </div>
              )
            )}
          </div>

          {/* Right Column: Stats & Actions */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-primary text-on-primary p-8 rounded-xl shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-headline text-2xl font-bold mb-6">Lending Pulse</h3>
                <div className="space-y-6">
                  <div>
                    <p className="text-primary-fixed-dim text-xs uppercase tracking-[0.2em] font-bold mb-1">Active Karma Earnings</p>
                    <p className="text-4xl font-headline font-bold text-secondary-fixed">{activeEarnings} CP</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-primary-fixed-dim text-[10px] uppercase tracking-widest font-bold mb-1">Items Out</p>
                      <p className="text-xl font-bold">{items.filter((i) => i.status === "rented").length}</p>
                    </div>
                    <div>
                      <p className="text-primary-fixed-dim text-[10px] uppercase tracking-widest font-bold mb-1">Total Listings</p>
                      <p className="text-xl font-bold">{items.length}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary opacity-20 blur-[60px] rounded-full -mr-16 -mt-16"></div>
            </div>

            <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10">
              <h4 className="font-bold text-sm uppercase tracking-widest text-on-surface-variant mb-4">Guidelines</h4>
              <ul className="space-y-4">
                <li className="flex gap-3 items-start">
                  <span className="material-symbols-outlined text-secondary text-lg">verified_user</span>
                  <p className="text-sm text-on-surface-variant">Inspected items upon return for campus security verification.</p>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="material-symbols-outlined text-secondary text-lg">history_edu</span>
                  <p className="text-sm text-on-surface-variant">Acceptance creates a digital lending agreement instantly.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
