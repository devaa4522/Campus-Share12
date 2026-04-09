"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";

type Profile = { id: string; full_name: string; avatar_url: string; karma_score?: number };

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

type Conversation = {
  id: string;
  deal_id: string;
  participant_1: string;
  participant_2: string;
  created_at: string;
  p1: Profile;
  p2: Profile;
  messages: Message[];
};

type DealInfo = {
  type: 'item' | 'task';
  id: string;
  status: string;
  title: string;
  image_url: string;
  reward_amount?: number;
  owner_id: string;
  requester_id: string;
  item_id?: string;
};

export default function MessageCenterClient({
  initialConversations,
  activeConversationId,
  userId,
}: {
  initialConversations: Conversation[];
  activeConversationId?: string;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  
  const [conversations, setConversations] = useState<Conversation[]>(
    Object.values(
      initialConversations.reduce((acc, conv) => {
        const peerId = conv.p1.id === userId ? conv.p2.id : conv.p1.id;
        const currentLastTime = conv.messages?.length > 0 
          ? new Date(conv.messages[conv.messages.length - 1].created_at).getTime() 
          : new Date(conv.created_at).getTime();

        if (!acc[peerId]) {
          acc[peerId] = conv;
        } else {
          const existingConv = acc[peerId];
          const existingLastTime = existingConv.messages?.length > 0 
            ? new Date(existingConv.messages[existingConv.messages.length - 1].created_at).getTime() 
            : new Date(existingConv.created_at).getTime();
            
          if (currentLastTime > existingLastTime) {
            acc[peerId] = conv;
          }
        }
        return acc;
      }, {} as Record<string, Conversation>)
    )
    .sort((a, b) => {
      const aTime = a.messages?.length > 0 ? new Date(a.messages[a.messages.length - 1].created_at).getTime() : new Date(a.created_at).getTime();
      const bTime = b.messages?.length > 0 ? new Date(b.messages[b.messages.length - 1].created_at).getTime() : new Date(b.created_at).getTime();
      return bTime - aTime;
    })
    .map(c => ({
      ...c,
      messages: c.messages ? [...c.messages].sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()) : []
    }))
  );
  
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [onlinePeers, setOnlinePeers] = useState<string[]>([]);
  const [peerTypingMap, setPeerTypingMap] = useState<Record<string, boolean>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  
  const [dealInfo, setDealInfo] = useState<DealInfo | null>(null);
  const [showQrModal, setShowQrModal] = useState<string | null>(null);
  const [showScannerModal, setShowScannerModal] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  const peer = activeConversation
    ? activeConversation.p1.id === userId
      ? activeConversation.p2
      : activeConversation.p1
    : null;

  // Viewport Optimization & PWA Hardware Back Logic
  // Viewport Optimization & PWA Hardware Back Logic
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    const bottomNav = document.querySelector('nav.fixed.bottom-0');

    if (activeConversationId) {
      // Hide nav on mobile when chat is open. On desktop it's already hidden via CSS.
      if (bottomNav) (bottomNav as HTMLElement).style.display = 'none';
      
      // Push state for hardware back button
      window.history.pushState({ isChat: true }, '', `/messages?id=${activeConversationId}`);
    } else {
      // Restore native CSS control (which handles md:hidden automatically)
      if (bottomNav) (bottomNav as HTMLElement).style.display = '';
      
      if (window.location.search.includes('id=')) {
        router.replace('/messages');
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      if (activeConversationId) {
        router.replace('/messages');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      document.body.style.overflow = '';
      // Always restore native CSS control completely when unmounting
      if (bottomNav) (bottomNav as HTMLElement).style.display = '';
      window.removeEventListener('popstate', handlePopState);
    }
  }, [activeConversationId, router]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (activeConversationId) {
      // Small timeout ensures the chat view transition has completed before deploying keyboard
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeConversationId]);

  // Fetch unified deal_id state (Handshake State Machine)
  useEffect(() => {
    if (!activeConversation) return;

    const fetchDeal = async () => {
      // 1. Try Item Requests
      const { data: itemReq } = await supabase
        .from("item_requests")
        .select("*, items(*)")
        .eq("id", activeConversation.deal_id)
        .maybeSingle();

      if (itemReq && itemReq.items) {
        setDealInfo({
          type: 'item',
          id: itemReq.id,
          status: itemReq.status, // pending, accepted, rented, returning, completed
          title: itemReq.items.title,
          image_url: itemReq.items.images?.[0] || '',
          reward_amount: itemReq.items.price_amount,
          owner_id: itemReq.items.user_id,
          requester_id: itemReq.requester_id,
          item_id: itemReq.items.id
        });
        return;
      }

      // 2. Try Tasks (if no item request matched)
      const { data: taskReq } = await supabase
        .from("tasks")
        .select("*, task_claims(*)")
        .eq("id", activeConversation.deal_id)
        .maybeSingle();
      
      if (taskReq) {
        setDealInfo({
          type: 'task',
          id: taskReq.id,
          status: taskReq.status, // open, claimed, completed, cancelled
          title: taskReq.title,
          image_url: '', // tasks usually don't have images in this schema, fallback
          reward_amount: taskReq.reward_amount,
          owner_id: taskReq.user_id,
          requester_id: taskReq.task_claims?.[0]?.claimed_by || activeConversation.participant_1, // guess if multiple
        });
      }
    };
    fetchDeal();
  }, [activeConversationId, activeConversation?.deal_id]);

  const handleQRConfirm = async (scannedPayload: string, expectedId: string) => {
    if (scannedPayload !== expectedId) {
      toast.error('Invalid QR Code for this specific deal!');
      return;
    }
    
    // Handshake execution
    try {
      if (dealInfo?.type === 'task') {
        const { error } = await supabase.rpc('complete_task_handshake', { qr_payload: expectedId });
        if (!error) {
           toast.success("Task Handshake Complete!");
           setDealInfo(prev => prev ? { ...prev, status: 'completed' } : prev);
        } else {
           toast.error("Failed to complete task handshake.");
        }
      } else if (dealInfo?.type === 'item') {
        // Item specific stages
        if (dealInfo.status === 'accepted') {
           // Transition to Rented
           await supabase.from("items").update({ status: 'rented' }).eq("id", dealInfo.item_id as string);
           await supabase.from("item_requests").update({ status: 'rented' }).eq("id", dealInfo.id);
           toast.success("Item handed over!");
           setDealInfo(prev => prev ? { ...prev, status: 'rented' } : prev);
        } else if (dealInfo.status === 'returning') {
           // Transition to Completed
           await supabase.from("items").update({ status: 'available' }).eq("id", dealInfo.item_id as string);
           await supabase.from("item_requests").update({ status: 'completed' }).eq("id", dealInfo.id);
           toast.success("Item returned safely!");
           setDealInfo(prev => prev ? { ...prev, status: 'completed' } : prev);
        }
      }
    } catch (e) {
      toast.error("Action could not be completed.");
    }
  };

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
      (error) => { /* ignore normal scanning errors */ }
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



  const handleAcceptDecline = async (action: 'accepted' | 'declined') => {
    if (!dealInfo) return;
    try {
      if (dealInfo.type === 'item') {
        await supabase.from("item_requests").update({ status: action }).eq("id", dealInfo.id);
        setDealInfo(prev => prev ? { ...prev, status: action } : prev);
        toast.success(`Request ${action}.`);
      } else {
        // For tasks, it's 'claimed' or 'cancelled' in this schema context.
        const newStatus = action === 'accepted' ? 'claimed' : 'open';
        await supabase.from("tasks").update({ status: newStatus }).eq("id", dealInfo.id);
        setDealInfo(prev => prev ? { ...prev, status: newStatus } : prev);
        toast.success(`Task status updated.`);
      }
    } catch (e) {
      toast.error(`Failed to apply action.`);
    }
  };
  
  const initiateReturn = async () => {
    if (!dealInfo) return;
    try {
      await supabase.from("item_requests").update({ status: 'returning' }).eq("id", dealInfo.id);
      setDealInfo(prev => prev ? { ...prev, status: 'returning' } : prev);
      toast.success("Return initiated! Show your QR code to the lender.");
    } catch(e) {
      toast.error("Error initiating return.");
    }
  };

  const cancelDeal = async () => {
    if (!dealInfo) return;
    try {
      // Execute the Trust Score Penalty
      await supabase.rpc('handle_lender_cancellation_penalty', { p_user_id: userId });
      
      if (dealInfo.type === 'item') {
         await supabase.from("item_requests").update({ status: 'declined' }).eq("id", dealInfo.id);
      } else {
         await supabase.from("tasks").update({ status: 'open' }).eq("id", dealInfo.id);
      }
      toast.error("Deal Cancelled. Karma penalty applied.");
      setDealInfo(prev => prev ? { ...prev, status: 'declined' } : prev);
      setShowCancelModal(false);
    } catch(e) {
      toast.error("Failed to cancel deal.");
    }
  };


  useEffect(() => {
    const channel = supabase.channel("public:messages", {
      config: { presence: { key: userId } }
    });

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          setConversations((prev) => 
            prev.map(c => {
              if (c.id === newMsg.conversation_id) {
                const filteredMessages = c.messages.filter(m => !(m.id.startsWith('temp-') && m.content === newMsg.content && m.sender_id === newMsg.sender_id));
                return { ...c, messages: [...filteredMessages, newMsg] };
              }
              return c;
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
           const updMsg = payload.new as Message;
           setConversations((prev) => 
              prev.map(c => {
                 if (c.id === updMsg.conversation_id) {
                    const updatedMessages = c.messages.map(m => m.id === updMsg.id ? updMsg : m);
                    return { ...c, messages: updatedMessages };
                 }
                 return c;
              })
           );
        }
      )
      .on('presence', { event: 'sync' }, () => {
         const state = channel.presenceState();
         setOnlinePeers(Object.keys(state));
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
         if (payload.payload && payload.payload.userId) {
            setPeerTypingMap(prev => ({ ...prev, [payload.payload.userId]: payload.payload.isTyping }));
         }
      })
      .subscribe(async (status) => {
         if (status === 'SUBSCRIBED') {
           await channel.track({ online_at: new Date().toISOString() });
         }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  useEffect(() => {
    if (!activeConversationId) return;
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    const hasUnread = conv.messages.some(m => !m.is_read && m.sender_id !== userId);
    if (hasUnread) {
       supabase.rpc("mark_conversation_as_read", { p_conversation_id: activeConversationId }).then();
    }
  }, [activeConversationId, conversations, supabase, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation, activeConversation?.messages]);

  // Safety Trust Guard: 5-Message Limit for Borrower before Acceptance
  const isPendingDeal = dealInfo?.status === 'pending' || dealInfo?.status === 'open';
  const isBorrower = dealInfo?.requester_id === userId;
  const borrowerMessageCount = activeConversation?.messages.filter(m => m.sender_id === userId).length || 0;
  const isInputLocked = isPendingDeal && isBorrower && borrowerMessageCount >= 5;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId || isInputLocked) return;

    if (editingMsg) {
       const content = newMessage.trim();
       setNewMessage("");
       setEditingMsg(null);
       setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(m => m.id === editingMsg.id ? { ...m, content } : m) } : c));
       await supabase.from("messages").update({ content }).eq("id", editingMsg.id);
       return;
    }

    const content = newMessage.trim();
    setNewMessage("");
    setShowEmojiPicker(false);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: userId,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setConversations((prev) => 
      prev.map(c => {
        if (c.id === activeConversationId) {
          return { ...c, messages: [...c.messages, optimisticMsg] };
        }
        return c;
      })
    );

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      sender_id: userId,
      content,
    });
    
    if (error) {
      toast.error(error.message || "Failed to send message. Please try again.");
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.filter(m => m.id !== tempId) } : c));
      setNewMessage(content); // restore content
    }
  };

  const handleKeyboardInput = (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => {
     setNewMessage(e.target.value);
     const channel = supabase.channel("public:messages");
     channel.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: true } });
     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
     typingTimeoutRef.current = setTimeout(() => {
        channel.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: false } });
     }, 2000);
  };

  const formatTimeSnippet = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // View Renderers for Handshake State
  const renderTransactionCard = () => {
    if (!dealInfo) return null;
    const isLender = dealInfo.owner_id === userId;

    let bgClass = "bg-primary text-white";
    let title = "Pending Request";
    let icon = "handshake";
    
    if (dealInfo.status === 'accepted' || dealInfo.status === 'claimed') {
        bgClass = "bg-secondary text-white";
        title = "Accepted - Awaiting Handover";
    } else if (dealInfo.status === 'rented') {
        bgClass = "bg-blue-600 text-white";
        title = "In-Use - Return by limit";
    } else if (dealInfo.status === 'returning') {
        bgClass = "bg-[#f0443a] text-white";
        title = "Return Initiated";
    } else if (dealInfo.status === 'completed') {
        bgClass = "bg-slate-800 text-white";
        title = "Deal Finished";
    }

    return (
      <div className="max-w-md mx-auto w-full bg-surface-container-lowest border shadow-md rounded-xl overflow-hidden mb-6 flex-shrink-0">
         <div className={`${bgClass} px-3 py-1.5 flex justify-between items-center`}>
            <span className="text-[10px] font-bold tracking-widest uppercase">{title}</span>
            <span className="material-symbols-outlined text-sm">{icon}</span>
         </div>
         <div className="p-3 flex gap-3 bg-surface-container-low">
             {dealInfo.image_url ? (
               <div className="w-16 h-16 rounded-md relative overflow-hidden">
                 <Image src={dealInfo.image_url} alt="Item" fill sizes="64px" className="object-cover" />
               </div>
             ) : (
               <div className="w-16 h-16 rounded-md bg-surface-variant flex items-center justify-center">
                 <span className="material-symbols-outlined text-outline">inventory_2</span>
               </div>
             )}
             <div className="flex-1">
                 <h5 className="font-serif font-bold text-[#000a1e] text-sm leading-tight">{dealInfo.title}</h5>
                 {dealInfo.reward_amount !== undefined && (
                 <p className="text-secondary font-bold text-xs mt-1">Escrow: ${dealInfo.reward_amount}</p>
                 )}
                 {peer?.karma_score !== undefined && (
                   <p className="text-[10px] text-outline font-medium mt-1 uppercase tracking-wider">Peer Trust: {peer.karma_score}</p>
                 )}
             </div>
             
             {dealInfo.status !== 'completed' && dealInfo.status !== 'declined' && isLender && (
                 <button className="material-symbols-outlined text-error hover:bg-error/10 p-1 rounded-full text-lg h-fit" onClick={() => setShowCancelModal(true)} title="Cancel Deal">more_vert</button>
             )}
         </div>
         
         {/* Interactivity Rows Based on Status */}
         <div className="p-3 flex gap-2 border-t border-outline-variant/10 text-xs font-bold">
            {(dealInfo.status === 'pending' || dealInfo.status === 'open') && isLender && (
                <>
                  <button onClick={() => handleAcceptDecline('accepted')} className="flex-1 py-2 bg-primary text-white rounded-lg active:scale-95 transition-all shadow-sm">Accept Request</button>
                  <button onClick={() => handleAcceptDecline('declined')} className="flex-1 py-2 bg-surface-container text-on-surface-variant rounded-lg active:scale-95 transition-all border border-outline-variant/30">Decline</button>
                </>
            )}

            {(dealInfo.status === 'pending' || dealInfo.status === 'open') && isBorrower && (
                <p className="text-center w-full text-outline italic">Waiting for owner approval.</p>
            )}

            {(dealInfo.status === 'accepted' || dealInfo.status === 'claimed') && isLender && (
                <button onClick={() => setShowScannerModal(dealInfo.id)} className="w-full bg-[#006e0c] text-white py-2 rounded-lg flex items-center justify-center gap-2 active:scale-95 shadow-md">
                   <span className="material-symbols-outlined text-sm">qr_code_scanner</span> Scan Borrower's QR
                </button>
            )}

            {(dealInfo.status === 'accepted' || dealInfo.status === 'claimed') && isBorrower && (
                <button onClick={() => setShowQrModal(dealInfo.id)} className="w-full bg-primary text-white py-2 rounded-lg flex items-center justify-center gap-2 active:scale-95 shadow-md">
                   <span className="material-symbols-outlined text-sm">qr_code_2</span> Show Receive QR
                </button>
            )}
            
            {dealInfo.status === 'rented' && isLender && (
                <button className="w-full bg-surface-container text-primary py-2 rounded-lg flex items-center justify-center gap-2 border border-outline-variant/30">
                   <span className="material-symbols-outlined text-sm">notifications_active</span> Send Return Reminder
                </button>
            )}

            {dealInfo.status === 'rented' && isBorrower && (
                <button onClick={initiateReturn} className="w-full bg-primary text-white py-2 rounded-lg flex items-center justify-center gap-2 active:scale-95">
                   <span className="material-symbols-outlined text-sm">assignment_return</span> Initiate Return
                </button>
            )}

            {dealInfo.status === 'returning' && isLender && (
                <button onClick={() => setShowQrModal(dealInfo.id)} className="w-full bg-primary text-white py-2 rounded-lg flex items-center justify-center gap-2 active:scale-95">
                   <span className="material-symbols-outlined text-sm">qr_code_2</span> Show Return QR
                </button>
            )}

            {dealInfo.status === 'returning' && isBorrower && (
                <button onClick={() => setShowScannerModal(dealInfo.id)} className="w-full bg-[#006e0c] text-white py-2 rounded-lg flex items-center justify-center gap-2 active:scale-95">
                   <span className="material-symbols-outlined text-sm">qr_code_scanner</span> Scan Lender's QR
                </button>
            )}
            
            {dealInfo.status === 'completed' && (
                <p className="text-center w-full text-outline italic">Transaction Finished</p>
            )}
         </div>
      </div>
    )
  }

  return (
    <>
    <div className="flex-1 w-full h-full flex overflow-hidden relative">
      {/* Sidebar: Conversation List */}
      <aside className={`w-full md:w-[420px] flex-col bg-surface-container-lowest border-r border-[#000a1e]/5 shrink-0 overflow-hidden ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 md:p-6 pt-6 md:pt-10 pb-4 border-b border-[#000a1e]/5 shrink-0 bg-surface-container-lowest/90 backdrop-blur-sm z-10 relative">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[#000a1e] mb-4">Messages</h1>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input className="w-full bg-surface border border-outline-variant/20 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary transition-all shadow-[0_2px_8px_rgba(0,10,30,0.02)]" placeholder="Search conversations..." type="text"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto w-full no-scrollbar">
          {conversations.length === 0 ? (
            <p className="text-center text-sm text-outline mt-10">No messages yet.</p>
          ) : (
            conversations.map((conv) => {
              const cp = conv.p1.id === userId ? conv.p2 : conv.p1;
              const isActive = activeConversationId === conv.id;
              
              const lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
              const unreadCount = conv.messages.filter(m => !m.is_read && m.sender_id !== userId).length;

              return (
                <div
                  key={conv.id}
                  onClick={() => router.push(`/messages?id=${conv.id}`)}
                  className={`group flex items-center p-4 cursor-pointer transition-colors border-b border-outline-variant/5 last:border-none ${
                    isActive ? "bg-primary/5 active:bg-primary/10 border-l-4 border-l-primary/60 pl-3 md:border-l-0 md:pl-4" : "hover:bg-surface-variant/40"
                  }`}
                >
                  <div className="relative shrink-0 w-12 h-12">
                    {cp.avatar_url ? (
                      <div className={`w-full h-full rounded-full overflow-hidden shadow-sm relative ${onlinePeers.includes(cp.id) ? 'ring-2 ring-secondary ring-offset-1' : ''}`}>
                        <Image src={cp.avatar_url} alt={cp.full_name} fill sizes="48px" className="object-cover" />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold font-serif shadow-sm ${onlinePeers.includes(cp.id) ? 'ring-2 ring-secondary ring-offset-1' : ''}`}>
                        {cp.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {onlinePeers.includes(cp.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                    )}
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-sm text-[#000a1e] truncate leading-tight">{cp.full_name}</h3>
                      {lastMessage && (
                        <span className={`text-[10px] whitespace-nowrap ml-2 ${unreadCount > 0 ? 'text-primary font-bold' : 'text-outline font-medium'}`}>
                          {formatTimeSnippet(lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <p className={`truncate mr-2 ${peerTypingMap[cp.id] ? 'text-secondary italic font-medium' : (unreadCount > 0 ? 'text-[#000a1e] font-semibold' : 'text-on-surface-variant')}`}>
                         {peerTypingMap[cp.id] ? 'typing...' : (lastMessage ? lastMessage.content : <i>No messages</i>)}
                       </p>
                       {unreadCount > 0 && (
                         <span className="bg-primary text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full shrink-0 shadow-sm">
                           {unreadCount}
                         </span>
                       )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      {activeConversationId ? (
        <section className={`absolute inset-0 z-20 md:relative md:inset-auto md:z-0 flex-1 h-full flex flex-col bg-surface overflow-hidden ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <header className="flex-none bg-surface-container-lowest/85 backdrop-blur-md px-4 py-4 md:py-6 border-b border-outline-variant/10 shadow-sm flex justify-between items-center z-30">
            <div className="flex items-center gap-3">
              <button className="md:hidden material-symbols-outlined text-[#000a1e] p-2 -ml-2 rounded-full active:bg-[#000a1e]/10 transition-colors" onClick={() => router.push('/messages')}>arrow_back</button>
              <div className="relative w-10 h-10">
                {peer?.avatar_url ? (
                  <div className="w-full h-full rounded-full overflow-hidden shadow-sm relative">
                    <Image src={peer.avatar_url} alt={peer.full_name} fill sizes="40px" className="object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-sm">{peer?.full_name?.charAt(0)}</div>
                )}
                {onlinePeers.includes(peer?.id || '') && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>}
              </div>
              <div className="flex flex-col">
                <h4 className="font-serif font-bold text-[#000a1e] text-sm leading-tight">{peer?.full_name}</h4>
                <span className={`text-[10px] font-medium uppercase tracking-widest ${onlinePeers.includes(peer?.id || '') ? 'text-green-600' : 'text-outline'}`}>{onlinePeers.includes(peer?.id || '') ? 'Active Now' : 'Offline'}</span>
              </div>
            </div>
          </header>

          {/* Feed */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 no-scrollbar flex flex-col items-center">
            {renderTransactionCard()}
            
            {activeConversation?.messages.map((msg, index) => {
               const isMe = msg.sender_id === userId;
               // Read Receipts
               const isRead = msg.is_read;
               const isDelivered = onlinePeers.includes(peer?.id || '');
               let tickIcon = 'check';
               let tickClass = 'text-outline/70';
               if (isRead) {
                 tickIcon = 'done_all';
                 tickClass = 'text-secondary font-bold';
               } else if (isDelivered) {
                 tickIcon = 'done_all';
                 tickClass = 'text-outline';
               }

               return (
                  <div key={msg.id} className={`flex ${isMe ? "flex-col items-end self-end max-w-[85%] md:max-w-[75%]" : "gap-3 max-w-[85%] md:max-w-[75%] self-start w-full"} group relative`}>
                    {!isMe && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 overflow-hidden self-end hidden md:block border border-outline-variant/20 shadow-sm relative">
                            {peer?.avatar_url ? <Image src={peer.avatar_url} alt="Profile" fill className="object-cover" /> : null}
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-1 w-full relative">
                        <div className={`p-3 md:p-4 text-sm leading-relaxed shadow-[0_2px_8px_rgba(0,10,30,0.03)] border border-outline-variant/10 ${
                            isMe 
                                ? "bg-primary-container text-white rounded-2xl rounded-tr-sm self-end max-w-full break-words" 
                                : "bg-surface-container-lowest text-on-surface rounded-2xl rounded-tl-sm w-fit break-words"
                        }`}>
                            {msg.content}
                        </div>
                        <div className={`flex items-center gap-1.5 px-1 ${isMe ? "justify-end text-outline" : "text-outline"}`}>
                            <span className="text-[10px] font-medium tracking-tight">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                                <span className={`material-symbols-outlined text-[14px] ${tickClass}`} style={{ fontVariationSettings: isRead || isDelivered ? "'FILL' 1" : "" }}>
                                    {tickIcon}
                                </span>
                            )}
                        </div>
                    </div>
                  </div>
               )
            })}
            
            {peerTypingMap[peer?.id || ''] && (
              <div className="flex gap-3 self-start animate-pulse max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 overflow-hidden self-end hidden md:block" />
                <div className="bg-surface-container-high px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center h-10 shadow-sm border border-outline-variant/10">
                    <div className="w-1.5 h-1.5 bg-outline rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-outline rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-outline rounded-full"></div>
                </div>
              </div>
            )}

            {isInputLocked && (
                <div className="bg-error-container/30 border border-error/10 px-4 py-3 rounded-xl flex items-start gap-3 w-full max-w-md my-4 shadow-sm">
                   <span className="material-symbols-outlined text-error shrink-0">info</span>
                   <div>
                       <p className="text-xs font-bold text-error">Message limit reached.</p>
                       <p className="text-[11px] text-on-error-container/90 mt-1 leading-relaxed">
                           You have used 5/5 messages for this pending request. Wait for the owner to accept to continue chatting.
                       </p>
                   </div>
                </div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Input Area */}
          <footer className="flex-none p-4 bg-surface-container-lowest/90 backdrop-blur-md border-t border-outline-variant/10 z-20 pb-safe">
            <form onSubmit={handleSendMessage} className="flex items-end gap-3 w-full">
              <button type="button" className="material-symbols-outlined text-outline hover:text-primary transition-colors mb-2 bg-surface-container-low p-2 rounded-full" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                 sentiment_satisfied
              </button>
              <div className="flex-1 bg-surface-container rounded-2xl flex items-center px-4 py-1.5 border border-transparent focus-within:border-primary/20 transition-all shadow-inner">
                 <textarea 
                    ref={inputRef}
                    className="bg-transparent border-none focus:ring-0 text-sm w-full py-2 placeholder:text-outline max-h-32 resize-none no-scrollbar disabled:opacity-50"
                    placeholder={isInputLocked ? "Waiting for approval..." : "Type a message..."}
                    rows={1}
                    value={newMessage}
                    onChange={(e) => {
                       handleKeyboardInput(e);
                       e.target.style.height = 'auto';
                       e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e as any);
                       }
                    }}
                    disabled={isInputLocked}
                 />
              </div>
              <button 
                 type="submit" 
                 className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5 shadow-md ${newMessage.trim() && !isInputLocked ? 'bg-primary text-white hover:opacity-90 active:scale-95' : 'bg-surface-variant text-outline cursor-not-allowed opacity-60'}`} 
                 disabled={!newMessage.trim() || isInputLocked}
              >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </form>
          </footer>
        </section>
      ) : (
        <section className="hidden md:flex flex-1 flex-col items-center justify-center bg-surface-container-lowest rounded-r-xl border border-outline-variant/10 text-on-surface-variant z-0">
          <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6 shadow-sm border border-outline-variant/20">
             <span className="material-symbols-outlined text-4xl text-outline">forum</span>
          </div>
          <h2 className="text-xl font-headline font-bold text-[#000a1e] mb-2 tracking-tight">Campus Market Messages</h2>
          <p className="text-sm">Select a conversation to maintain your deals securely.</p>
        </section>
      )}

      {/* Modals for QR / Scanning */}
      {showQrModal && (
        <div className="fixed inset-0 bg-[#000a1e]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-200">
             <h3 className="font-headline font-bold text-xl text-[#000a1e] mb-2">Deal Verification</h3>
             <p className="text-sm text-outline mb-6">Show this QR code to the other party to advance the handshake stage.</p>
             <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20 inline-block mb-6 shadow-inner">
               <QRCode value={showQrModal} size={180} />
             </div>
             <button aria-label="close" onClick={() => setShowQrModal(null)} className="w-full py-3 border border-outline-variant/30 text-primary font-bold rounded-lg shadow-sm hover:bg-surface-container-low transition-colors">Close</button>
          </div>
        </div>
      )}

      {showScannerModal && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col">
          <header className="flex justify-between items-center p-4 bg-black/50 absolute top-0 w-full z-10 text-white">
             <h3 className="font-bold text-sm uppercase tracking-widest">Verify QR Code</h3>
             <button onClick={() => setShowScannerModal(null)} className="material-symbols-outlined p-2 bg-white/10 rounded-full">close</button>
          </header>
          <div id="qr-reader" className="flex-1 w-full bg-black flex items-center justify-center"></div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-[#000a1e]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-outline-variant/10">
                <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-error">warning</span>
                </div>
                <h2 className="font-serif font-bold text-xl text-[#000a1e] mb-2 tracking-tight">Cancel Transaction?</h2>
                <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                    Cancelling this active request will result in a <span className="text-error font-bold">-5 Karma Score penalty</span> to ensure community reliability. Proced?
                </p>
                <div className="flex flex-col gap-3">
                    <button onClick={cancelDeal} className="w-full py-3 bg-error text-white font-bold rounded-xl active:scale-95 transition-all shadow-md hover:bg-error/90">Yes, Accept Penalty</button>
                    <button onClick={() => setShowCancelModal(false)} className="w-full py-3 bg-surface-container text-[#000a1e] font-bold rounded-xl active:scale-95 transition-all border border-outline-variant/20 shadow-sm hover:bg-surface-variant">No, Go Back</button>
                </div>
            </div>
        </div>
      )}
    </div>
    </>
  );
}
