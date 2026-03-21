"use client";

import { useState, useEffect } from "react";
import type { Item, Profile, ItemRequest } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";

type DealTab = "made" | "received" | "my_listings" | "task_requests" | "helping_with";

interface RequestWithRelations extends ItemRequest {
  items: (Item & { profiles?: Profile | null }) | null;
  profiles: Profile | null;
}

export default function DashboardClient({
  profile,
  items,
  madeRequests,
  receivedRequests,
  myTaskRequests = [],
  helpingWithTasks = [],
}: {
  profile: Profile;
  items: Item[];
  madeRequests: any[];
  receivedRequests: any[];
  myTaskRequests?: any[];
  helpingWithTasks?: any[];
}) {
  const [activeTab, setActiveTab] = useState<DealTab>("received");
  const [localMade, setLocalMade] = useState<RequestWithRelations[]>(madeRequests);
  const [localReceived, setLocalReceived] = useState<RequestWithRelations[]>(receivedRequests);
  const [localTaskRequests, setLocalTaskRequests] = useState<any[]>(myTaskRequests);
  const [localHelpingWith, setLocalHelpingWith] = useState<any[]>(helpingWithTasks);
  const [showQrModal, setShowQrModal] = useState<string | null>(null);
  const [showScannerModal, setShowScannerModal] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!showScannerModal) return;

    const html5QrCode = new Html5Qrcode("qr-reader");

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        setShowScannerModal(null);
        handleQRConfirm(decodedText, showScannerModal);
      },
      (error) => { /* ignore */ }
    ).catch(err => {
      console.error(err);
      toast.error("Camera access failed. Please check permissions.");
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(e => console.error(e));
      } else {
        html5QrCode.clear();
      }
    };
  }, [showScannerModal]);

  async function handleQRConfirm(scannedPayload: string, expectedTaskId: string) {
    if (scannedPayload !== expectedTaskId) {
      toast.error('Invalid QR Code for this specific task!');
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('complete_task_handshake', { qr_payload: expectedTaskId });
      
      if (!error) {
         toast.success("Task formally completed! Escrow released & Karma awarded.");
         setLocalTaskRequests(prev => prev.map(t => t.id === expectedTaskId ? { ...t, status: "completed" } : t));
      } else {
         toast.error("Campus Network Busy: Please try again.");
      }
    } catch (e) {
      toast.error("Campus Network Busy: Please try again.");
    }
  }

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

  async function handleMarkTaskDone(taskId: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
      if (!error) {
         toast.success("Task completed & Karma awarded!");
         setLocalTaskRequests(prev => prev.map(t => t.id === taskId ? { ...t, status: "completed" } : t));
      } else {
         toast.error("Campus Network Busy: Please try again.");
      }
    } catch (e) {
      toast.error("Campus Network Busy: Please try again.");
    }
  }

  async function handleCancelHelp(claimId: string, taskId: string) {
    try {
      const supabase = createClient();
      const { data: result, error } = await supabase.rpc("cancel_task_claim", { c_id: claimId, u_id: profile.id });
      
      if (!error) {
         if (result?.penalty_applied) {
             toast.error("Help cancelled. 10% Escrow Penalty applied due to 10-Minute rule.");
         } else {
             toast.success("Help cancelled. Escrow refunded safely.");
         }
         setLocalHelpingWith(prev => prev.filter(c => c.id !== claimId));
      } else {
         toast.error("Campus Network Busy: Please try again.");
      }
    } catch (e) {
      toast.error("Campus Network Busy: Please try again.");
    }
  }

  const handleMessageForTask = async (taskId: string) => {
    try {
      const supabase = createClient();
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("deal_id", taskId)
        .single();
      
      if (existingConv) {
         router.push(`/messages?id=${existingConv.id}`);
      } else {
         toast.error("Campus Network Busy: Please try again.");
      }
    } catch (e) {
      toast.error("Campus Network Busy: Please try again.");
    }
  };

  const handleMessageUser = async (req: RequestWithRelations) => {
    const lenderId = req.items?.user_id;
    const borrowerId = req.requester_id;
    if (!lenderId || !borrowerId) return;

    try {
      const supabase = createClient();
      // 1. Check if conversation already exists for this deal
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("deal_id", req.id)
        .single();

      if (existingConv) {
         router.push(`/messages?id=${existingConv.id}`);
         return;
      }

      // 2. Create the unified conversation room
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
           deal_id: req.id,
           participant_1: borrowerId,
           participant_2: lenderId
        })
        .select()
        .single();

      if (error || !newConv) {
         toast.error("Could not start conversation");
         return;
      }

      router.push(`/messages?id=${newConv.id}`);
    } catch (e) {
      toast.error("Error connecting to chat");
    }
  };

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
                <button onClick={() => handleMessageUser(req)} className="text-secondary font-bold text-sm flex items-center gap-1 hover:underline">
                    Message {isLenderView ? 'Borrower' : 'Lender'} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTaskRequestCard = (task: any) => {
    const helperProfile = task.task_claims?.[0]?.profiles;
    const deadlineText = task.deadline 
      ? new Date(task.deadline).getTime() > new Date().getTime() 
        ? Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) + ' Days Left'
        : 'Overdue'
      : 'Flexible Target';

    return (
      <div key={task.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10 flex flex-col md:flex-row gap-6">
        <div className="flex-grow flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
               <div>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold tracking-wider uppercase mb-2 inline-block ${
                    task.category === 'Academic' ? 'bg-primary/10 text-primary' :
                    task.category === 'Delivery' ? 'bg-secondary/10 text-secondary' : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {task.category || 'General'}
                  </span>
                  <h3 className="font-headline text-xl font-bold text-primary">{task.title}</h3>
               </div>
               <div className="text-right">
                 <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    task.status === 'open' ? 'bg-error/10 text-error' :
                    task.status === 'claimed' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary text-white'
                 }`}>
                   {task.status}
                 </span>
                 <p className="text-[10px] text-on-surface-variant font-bold uppercase mt-1.5 tracking-widest">{deadlineText}</p>
               </div>
            </div>
            
            {task.status === 'claimed' && helperProfile && (
              <div className="flex items-center gap-3 mt-4 py-3 border-y border-outline-variant/10">
                <span className="text-xs uppercase font-bold tracking-widest text-on-surface-variant">Helper:</span>
                <span className="text-sm font-semibold text-primary">{helperProfile.full_name}</span>
                 <button onClick={() => handleMessageForTask(task.id)} className="ml-auto text-secondary text-xs uppercase font-bold hover:underline flex items-center gap-1">Message <span className="material-symbols-outlined text-[14px]">chevron_right</span></button>
              </div>
            )}
            {task.status === 'completed' && helperProfile && (
              <div className="flex items-center gap-3 mt-4 py-3 border-y border-outline-variant/10">
                <span className="text-xs uppercase font-bold tracking-widest text-[#006e0c]">Completed By:</span>
                <span className="text-sm font-semibold text-primary">{helperProfile.full_name}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 mt-4">
            {task.status === 'claimed' && (
              <button onClick={() => setShowScannerModal(task.id)} className="bg-primary text-white px-6 py-2 rounded-lg font-bold text-sm tracking-widest uppercase hover:bg-slate-800 transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span> Scan to Confirm
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHelpingCard = (claim: any) => {
    const task = claim.tasks;
    if (!task) return null;
    const creator = task.profiles;

    const deadlineText = task.deadline 
      ? new Date(task.deadline).getTime() > new Date().getTime() 
        ? Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) + ' Days Left'
        : 'Overdue'
      : 'Flexible Target';

    return (
      <div key={claim.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10 flex flex-col md:flex-row gap-6 border-l-4 border-l-secondary">
        <div className="flex-grow flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
               <div>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold tracking-wider uppercase mb-2 inline-block bg-surface-container-high text-on-surface-variant`}>
                    {task.category || 'General'}
                  </span>
                  <h3 className="font-headline text-xl font-bold text-primary">{task.title}</h3>
               </div>
               <div className="text-right">
                 <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    task.status === 'claimed' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary text-white'
                 }`}>
                   {task.status}
                 </span>
                 {task.status === 'claimed' && (
                    <p className="text-[10px] text-error font-bold uppercase mt-1.5 tracking-widest">Escrow: {Math.floor((task.reward_amount || 0) * 0.1)} CP Locked</p>
                 )}
                 <p className="text-[10px] text-on-surface-variant font-bold uppercase mt-1 tracking-widest">{deadlineText}</p>
               </div>
            </div>
            
            {creator && (
              <div className="flex items-center gap-3 mt-4 py-3 border-y border-outline-variant/10">
                <span className="text-xs uppercase font-bold tracking-widest text-on-surface-variant">Requester:</span>
                <span className="text-sm font-semibold text-primary">{creator.full_name}</span>
              </div>
            )}
            <p className="text-sm text-on-surface-variant mt-3 line-clamp-2">{task.description}</p>
          </div>
          
          <div className="flex gap-4 mt-4 items-center">
            {task.status === 'claimed' && (
              <>
                <button onClick={() => setShowQrModal(task.id)} className="bg-primary text-white shadow-md shadow-primary/20 px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">qr_code_2</span> Complete Task
                </button>
                <button onClick={() => handleCancelHelp(claim.id, task.id)} className="border border-outline-variant/30 text-error px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-error/5 transition-colors">
                  Cancel Help
                </button>
                <button onClick={() => handleMessageForTask(task.id)} className="text-secondary font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-1">
                  Message <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000a1e]/80 backdrop-blur-md p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-outline-variant/10 text-center relative p-8">
            <button
               onClick={() => setShowQrModal(null)}
               className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
            >
               <span className="material-symbols-outlined text-on-surface-variant">close</span>
            </button>
            <h2 className="font-headline font-bold text-2xl text-primary mb-2">Proof of Work</h2>
            <p className="text-on-surface-variant font-body text-sm mb-6 leading-relaxed">Present this encrypted Handshake to the Task Creator. Verifying this grants your total Karma Reward and unbinds Escrow.</p>
            <div className="bg-white p-6 rounded-2xl inline-block shadow-lg mx-auto mb-6 border-4 border-[#006e0c]">
               <QRCode value={showQrModal} size={220} fgColor="#000a1e" />
            </div>
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#006e0c]">Encrypted Subroutine Active</p>
          </div>
        </div>
      )}

      {showScannerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000a1e]/80 backdrop-blur-md p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-outline-variant/10 text-center relative p-8">
            <button
               onClick={() => setShowScannerModal(null)}
               className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-error/10 hover:bg-error/20 transition-colors z-[120]"
            >
               <span className="material-symbols-outlined text-error font-bold block">close</span>
            </button>
            <h2 className="font-headline font-bold text-2xl text-primary mb-2">Scan Handshake</h2>
            <p className="text-on-surface-variant font-body text-sm mb-6">Point your camera strictly at the Helper&apos;s Proof of Work QR schema to mathematically conclude this transaction.</p>
            <div className="bg-[#000a1e] rounded-2xl overflow-hidden shadow-inner border-4 border-error mb-2">
               <div id="qr-reader" className="w-full h-full min-h-[250px] bg-black"></div>
            </div>
          </div>
        </div>
      )}

    <div className="px-6 max-w-7xl mx-auto min-h-screen pt-24 pb-8">
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
          <button 
            onClick={() => setActiveTab("task_requests")}
            className={`pb-4 tracking-tight transition-colors relative ${activeTab === "task_requests" ? "text-primary font-bold border-b-2 border-primary" : "text-on-surface-variant font-medium hover:text-primary"}`}
          >
            My Task Requests
          </button>
          <button 
            onClick={() => setActiveTab("helping_with")}
            className={`pb-4 tracking-tight transition-colors relative ${activeTab === "helping_with" ? "text-primary font-bold border-b-2 border-primary" : "text-on-surface-variant font-medium hover:text-primary"}`}
          >
            Helping With
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
            ) : activeTab === "task_requests" ? (
              localTaskRequests.length > 0 ? (
                localTaskRequests.map(task => renderTaskRequestCard(task))
              ) : (
                <div className="text-center py-12 text-on-surface-variant border-2 border-dashed border-outline-variant/30 rounded-xl">
                  You haven't posted any tasks yet.
                </div>
              )
            ) : activeTab === "helping_with" ? (
              localHelpingWith.length > 0 ? (
                localHelpingWith.map(claim => renderHelpingCard(claim))
              ) : (
                <div className="text-center py-12 text-on-surface-variant border-2 border-dashed border-outline-variant/30 rounded-xl">
                  You aren't helping with any tasks right now.
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
    </>
  );
}
