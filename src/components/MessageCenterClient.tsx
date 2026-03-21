"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

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

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  const peer = activeConversation
    ? activeConversation.p1.id === userId
      ? activeConversation.p2
      : activeConversation.p1
    : null;

  useEffect(() => {
    // Zero-Refresh UI & Global listener
    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          setConversations((prev) => 
            prev.map(c => {
              if (c.id === newMsg.conversation_id) {
                const updatedMessages = [...c.messages, newMsg];
                return { ...c, messages: updatedMessages };
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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

    const content = newMessage.trim();
    setNewMessage("");

    await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      sender_id: userId,
      content,
    });
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
        <div className="p-6 pb-4 border-b border-outline-variant/10">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-primary mb-5">Messages</h1>
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
                      <img className="w-12 h-12 rounded-full object-cover" src={cp.avatar_url} alt={cp.full_name} />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-surface-container-highest border border-outline-variant/20 flex items-center justify-center text-on-surface-variant font-bold">
                        {cp.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-sm text-primary truncate">{cp.full_name}</span>
                      {lastMessage && (
                        <span className={`text-[10px] whitespace-nowrap ml-2 ${unreadCount > 0 ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>
                          {formatTimeSnippet(lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                       <p className={`truncate mr-2 ${unreadCount > 0 ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
                         {lastMessage ? lastMessage.content : <i>No messages</i>}
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
        <section className={`flex-1 flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-[0_12px_32px_rgba(0,10,30,0.06)] overflow-hidden ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          {/* Chat Header */}
          <div className="px-6 md:px-8 py-4 flex items-center gap-4 border-b border-surface-container-low bg-surface">
            <button className="md:hidden material-symbols-outlined text-on-surface-variant p-2 -ml-2 rounded-full hover:bg-surface-container-low" onClick={() => router.push('/messages')}>arrow_back</button>
            <div className="flex items-center space-x-3 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant/20 flex items-center justify-center overflow-hidden">
                {peer?.avatar_url ? (
                  <img className="w-full h-full object-cover" src={peer.avatar_url} alt={peer.full_name} />
                ) : (
                  <span className="font-bold text-on-surface-variant">{peer?.full_name?.charAt(0)}</span>
                )}
              </div>
              <div className="flex flex-col">
                <h2 className="font-semibold text-primary leading-tight text-sm">{peer?.full_name}</h2>
                <span className="text-[10px] text-secondary font-medium tracking-wide">Connected</span>
              </div>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center space-x-2 text-on-surface-variant">
              <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors"><span className="material-symbols-outlined text-[20px]">videocam</span></button>
              <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors"><span className="material-symbols-outlined text-[20px]">call</span></button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide bg-[#f7f9fb] dark:bg-[#0c121e]" style={{ scrollbarWidth: 'none' }}>
            <div className="flex justify-center mb-6">
              <div className="bg-surface-container-low px-4 py-2 rounded-lg flex items-center space-x-2 border border-outline-variant/10 shadow-sm">
                <span className="material-symbols-outlined text-sm text-secondary">lock</span>
                <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">End-to-End Encrypted</span>
              </div>
            </div>

            {activeConversation?.messages.map((msg, index) => {
               const isMe = msg.sender_id === userId;
               // Read Receipts logic
               const statusIconStyles = msg.is_read ? 'text-secondary' : 'text-on-surface-variant opacity-60';

               return (
                  <div key={msg.id} className={`flex flex-col items-${isMe ? "end" : "start"} space-y-1 w-full`}>
                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm max-w-[75%] md:max-w-[65%] ${
                      isMe 
                        ? "bg-secondary text-white rounded-br-sm" 
                        : "bg-white dark:bg-slate-800 text-on-surface rounded-bl-sm border border-outline-variant/10"
                    }`}>
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? "text-white/80" : "text-on-surface-variant"}`}>
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          <span className={`material-symbols-outlined text-[14px] leading-none ${msg.is_read ? 'text-white font-bold' : 'text-white/60'}`} style={msg.is_read ? { fontVariationSettings: "'FILL' 1" } : {}}>
                            done_all
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
               )
            })}
            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Message Input */}
          <div className="p-3 md:p-5 bg-surface border-t border-surface-container-low">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-3 bg-surface-container-lowest rounded-full border border-outline-variant/20 p-1 pl-2 shadow-sm">
              <button type="button" className="p-2 text-on-surface-variant hover:text-secondary hover:bg-surface-container-low rounded-full transition-colors flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">add</span>
              </button>
              <input 
                type="text" 
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm py-3" 
                placeholder="Type a message" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 mr-1 ${newMessage.trim() ? 'bg-secondary text-white hover:opacity-90 active:scale-95 shadow-md' : 'bg-surface-container-low text-on-surface-variant opacity-50 cursor-default'}`} disabled={!newMessage.trim()}>
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
