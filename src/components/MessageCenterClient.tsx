"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import EmojiPicker from "emoji-picker-react";

type Profile = { id: string; full_name: string; avatar_url: string };

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
    initialConversations.map(c => ({
      ...c,
      messages: c.messages ? [...c.messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : []
    }))
  );
  
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 10 & 11 State Expansions
  const [onlinePeers, setOnlinePeers] = useState<string[]>([]);
  const [peerTypingMap, setPeerTypingMap] = useState<Record<string, boolean>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  const peer = activeConversation
    ? activeConversation.p1.id === userId
      ? activeConversation.p2
      : activeConversation.p1
    : null;

  useEffect(() => {
    // Zero-Refresh UI & Global Presence listener
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
                // Filter out optimistic local injections
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

  // Mark conversation as read whenever it's opened or updated (if looking at it)
  useEffect(() => {
    if (!activeConversationId) return;
    
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;

    const hasUnread = conv.messages.some(m => !m.is_read && m.sender_id !== userId);
    
    if (hasUnread) {
       // Call RPC to instantly mark messages and notifications as read
       supabase.rpc("mark_conversation_as_read", { p_conversation_id: activeConversationId }).then();
    }
  }, [activeConversationId, conversations, supabase, userId]);

  useEffect(() => {
    // Auto scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation, activeConversation?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId) return;

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

    // Zero-Lag Optimistic UI Injection
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

    await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      sender_id: userId,
      content,
    });
  };

  const handleDeleteMessage = async (msgId: string) => {
     setContextMenuMsgId(null);
     setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.filter(m => m.id !== msgId) } : c));
     await supabase.from("messages").delete().eq("id", msgId);
  };

  const handleKeyboardInput = (e: React.ChangeEvent<HTMLInputElement>) => {
     setNewMessage(e.target.value);
     const channel = supabase.channel("public:messages");
     channel.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: true } });
     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
     typingTimeoutRef.current = setTimeout(() => {
        channel.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: false } });
     }, 2000);
  };

  const selectConversation = (id: string) => {
    router.push(`/messages?id=${id}`);
  };

  // Helper for timestamp formatting
  const formatTimeSnippet = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-1 h-full max-w-7xl mx-auto w-full px-4 md:px-6 py-6 pb-20 md:pb-6 gap-6">
      {/* Left Sidebar: Conversation List */}
      <aside className={`w-full md:w-96 flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-sm border border-outline-variant/10 ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 pb-4 border-b border-[#000a1e]/10">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[#000a1e] mb-5">Messages</h1>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-full pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary transition-all" placeholder="Search chats..." type="text"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto w-full scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {conversations.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant mt-10">No messages yet.</p>
          ) : (
            conversations.map((conv) => {
              const cp = conv.p1.id === userId ? conv.p2 : conv.p1;
              const isActive = activeConversationId === conv.id;
              
              const lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
              const unreadCount = conv.messages.filter(m => !m.is_read && m.sender_id !== userId).length;

              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`group flex items-center px-6 py-4 cursor-pointer transition-all border-b border-outline-variant/5 last:border-none ${
                    isActive 
                      ? "bg-surface-container-highest shadow-inner" 
                      : "hover:bg-surface-container-high"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {cp.avatar_url ? (
                      <img className={`w-12 h-12 rounded-full object-cover ${onlinePeers.includes(cp.id) ? 'ring-2 ring-[#006e0c] ring-offset-2 ring-offset-[#f7f9fb]' : ''}`} src={cp.avatar_url} alt={cp.full_name} />
                    ) : (
                      <div className={`w-12 h-12 rounded-full bg-surface-container-highest border border-outline-variant/20 flex items-center justify-center text-on-surface-variant font-bold ${onlinePeers.includes(cp.id) ? 'ring-2 ring-[#006e0c] ring-offset-2 ring-offset-[#f7f9fb]' : ''}`}>
                        {cp.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-headline font-bold text-sm text-[#000a1e] truncate">{cp.full_name}</h3>
                      {lastMessage && (
                        <span className={`text-[10px] whitespace-nowrap ml-2 ${unreadCount > 0 ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>
                          {formatTimeSnippet(lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                       <p className={`truncate mr-2 ${peerTypingMap[cp.id] ? 'text-secondary italic' : (unreadCount > 0 ? 'text-on-surface font-semibold' : 'text-on-surface-variant')}`}>
                         {peerTypingMap[cp.id] ? 'typing...' : (lastMessage ? lastMessage.content : <i>No messages</i>)}
                       </p>
                       {unreadCount > 0 && (
                         <span className="bg-secondary text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full shrink-0">
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

      {/* Right Pane: Active Chat */}
      {activeConversationId ? (
        <section className={`flex-1 flex flex-col bg-[#f7f9fb] rounded-xl border border-[#000a1e]/10 shadow-[0px_12px_32px_rgba(0,10,30,0.06)] overflow-hidden ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          {/* Chat Header */}
          <div className="px-6 md:px-8 py-4 flex items-center gap-4 border-b border-[#000a1e]/10 bg-[#f7f9fb]/85 backdrop-blur-md z-10 sticky top-0 shadow-sm">
            <button className="md:hidden material-symbols-outlined text-[#000a1e]/60 p-2 -ml-2 rounded-full hover:bg-[#000a1e]/5" onClick={() => router.push('/messages')}>arrow_back</button>
            <div className="flex items-center space-x-3 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#f7f9fb] border border-[#000a1e]/10 flex items-center justify-center overflow-hidden">
                {peer?.avatar_url ? (
                  <img className="w-full h-full object-cover" src={peer.avatar_url} alt={peer.full_name} />
                ) : (
                  <span className="font-bold text-on-surface-variant">{peer?.full_name?.charAt(0)}</span>
                )}
              </div>
              <div className="flex flex-col">
                <h2 className="font-headline font-bold text-[#000a1e] leading-tight text-sm">{peer?.full_name}</h2>
                <span className="text-[10px] text-[#006e0c] font-medium tracking-wide">
                  {onlinePeers.includes(peer?.id || '') ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center space-x-2 text-[#000a1e]/60">
              <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#000a1e]/5 transition-colors"><span className="material-symbols-outlined text-[20px]">more_vert</span></button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide chat-wallpaper" onClick={() => setContextMenuMsgId(null)}>
            <div className="flex justify-center mb-6">
              <div className="bg-surface-container-lowest px-4 py-2 rounded-lg flex items-center space-x-2 border border-outline-variant/10 shadow-[0px_12px_32px_rgba(0,10,30,0.04)]">
                <span className="material-symbols-outlined text-sm text-secondary">lock</span>
                <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">End-to-End Encrypted</span>
              </div>
            </div>

            {activeConversation?.messages.map((msg, index) => {
               const isMe = msg.sender_id === userId;
               // Read Receipts logic
               const isRead = msg.is_read;
               const isDelivered = onlinePeers.includes(peer?.id || '');
               let tickIcon = 'check'; // 1 gray tick
               let tickClass = 'text-white/60';
               
               if (isRead) {
                 tickIcon = 'done_all';
                 tickClass = 'text-[#006e0c] font-bold'; // Scholar Green
               } else if (isDelivered) {
                 tickIcon = 'done_all';
                 tickClass = 'text-white/80';
               }

               const in5Mins = (new Date().getTime() - new Date(msg.created_at).getTime()) < 300000;
               const isEditable = isMe && !msg.is_read && in5Mins && !msg.id.startsWith("temp-");

               return (
                  <div key={msg.id} className={`flex flex-col items-${isMe ? "end" : "start"} space-y-1 w-full group relative`} onContextMenu={(e) => { e.preventDefault(); if (isEditable) setContextMenuMsgId(msg.id) }}>
                    <div className={`relative px-6 py-3 rounded-2xl max-w-[75%] md:max-w-[65%] ${
                  isMe 
                    ? "bg-[#000a1e] bg-gradient-to-br from-[#000a1e] to-[#001a35] text-white rounded-br-sm shadow-sm" 
                    : "bg-white text-[#000a1e] rounded-bl-sm border border-[#000a1e]/10 shadow-[0px_4px_12px_rgba(0,10,30,0.03)]"
                }`}>
                      
                      {isEditable && (
                        <>
                           {/* Hover Menu Trigger Desktop */}
                           <div onClick={() => setContextMenuMsgId(msg.id)} className="hidden md:block absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-on-surface-variant">
                             <span className="material-symbols-outlined text-sm">expand_more</span>
                           </div>
                           
                           {/* Context Menu Toolkit */}
                           {contextMenuMsgId === msg.id && (
                             <div className="absolute -left-20 top-0 bg-surface-container-lowest shadow-xl rounded-lg py-2 w-24 opacity-100 transition-opacity border border-outline-variant/10 z-10 text-on-surface">
                               <button onClick={() => { setEditingMsg(msg); setNewMessage(msg.content); setContextMenuMsgId(null); }} className="w-full text-left px-4 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-low transition-colors">Edit</button>
                               <button onClick={() => handleDeleteMessage(msg.id)} className="w-full text-left px-4 py-1.5 text-xs text-error hover:bg-error/5 transition-colors">Delete</button>
                             </div>
                           )}
                        </>
                      )}

                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? "text-slate-400" : "text-on-surface-variant"}`}>
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          <span className={`${tickClass} material-symbols-outlined text-[14px] leading-none`} style={{ fontVariationSettings: isRead || isDelivered ? "'FILL' 1" : "" }}>
                            {tickIcon}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
               )
            })}
            
            {peerTypingMap[peer?.id || ''] && (
              <div className="flex items-center space-x-2 w-full mt-2">
                 <div className="bg-surface-container-high w-12 h-6 rounded-full flex items-center justify-center space-x-1">
                 <div className="w-1 h-1 bg-on-surface-variant/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-1 h-1 bg-on-surface-variant/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-1 h-1 bg-on-surface-variant/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                 </div>
                 <span className="text-[10px] font-medium text-on-surface-variant italic">{peer?.full_name} is typing...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Message Input */}
          <div className="p-3 md:p-5 bg-surface-container-lowest/90 backdrop-blur-md relative border-t border-outline-variant/10">
            {showEmojiPicker && (
               <div className="absolute bottom-20 left-4 z-50">
                   <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)}></div>
                   <div className="relative z-50 shadow-2xl rounded-xl"><EmojiPicker onEmojiClick={(e) => setNewMessage(prev => prev + e.emoji)} /></div>
               </div>
            )}
            
            {editingMsg && (
               <div className="flex items-center justify-between bg-surface-container-low px-4 py-2 mb-2 rounded-lg text-xs font-semibold text-primary">
                  <span>Editing Message...</span>
                  <button type="button" onClick={() => { setEditingMsg(null); setNewMessage(""); }} className="text-secondary hover:underline">Cancel</button>
               </div>
            )}
            
            <form onSubmit={handleSendMessage} className="flex items-center space-x-3 bg-surface-container-low rounded-2xl border border-transparent focus-within:border-outline-variant/30 px-2 py-1 shadow-sm transition-all focus-within:shadow-md">
              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">sentiment_satisfied</span>
              </button>
              <button type="button" className="p-2 text-on-surface-variant hover:text-primary transition-colors hidden md:flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">attach_file</span>
              </button>
              <input 
                type="text" 
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm py-3" 
                placeholder={editingMsg ? "Edit your message..." : "Type a message..."} 
                value={newMessage}
                onChange={handleKeyboardInput}
              />
              <button type="submit" className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 mr-1 ${newMessage.trim() ? 'bg-[#000a1e] text-white hover:scale-102 active:scale-95 shadow-md' : 'bg-surface-container-highest text-on-surface-variant opacity-50 cursor-default'}`} disabled={!newMessage.trim()}>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="hidden md:flex flex-1 flex-col items-center justify-center bg-surface-container-lowest rounded-xl border border-outline-variant/10 text-on-surface-variant">
          <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mb-6">
             <span className="material-symbols-outlined text-4xl text-outline">forum</span>
          </div>
          <h2 className="text-xl font-headline font-bold text-primary mb-2">Campus Share Web</h2>
          <p className="text-sm">Select a conversation to start messaging seamlessly.</p>
        </section>
      )}
    </div>
  );
}
