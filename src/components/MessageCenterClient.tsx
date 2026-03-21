"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

type Profile = { id: string; full_name: string; avatar_url: string };
type Conversation = {
  id: string;
  deal_id: string;
  participant_1: string;
  participant_2: string;
  created_at: string;
  p1: Profile;
  p2: Profile;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
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
    initialConversations
  );
  const [messages, setMessages] = useState<Message[]>([]);
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
    // Fetch messages for the active conversation
    const fetchMessages = async () => {
      if (!activeConversationId) return;
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
        
      if (!error && data) {
        setMessages(data);
      }
      
      // Mark as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", activeConversationId)
        .neq("sender_id", userId)
        .eq("is_read", false);
    };
    
    fetchMessages();
  }, [activeConversationId, userId, supabase]);

  useEffect(() => {
    if (!activeConversationId) return;

    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          // Mark read
          if (payload.new.sender_id !== userId) {
            supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", payload.new.id)
              .then();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, supabase, userId]);

  useEffect(() => {
    // Auto scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  return (
    <div className="flex flex-1 h-full max-w-7xl mx-auto w-full px-4 md:px-6 py-6 pb-20 md:pb-6 gap-6">
      {/* Left Sidebar: Conversation List */}
      <aside className={`w-full md:w-96 flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-sm ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-primary mb-6">Message Center</h1>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input className="w-full bg-surface-container-lowest border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary transition-all" placeholder="Search conversations..." type="text"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {conversations.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant mt-10">No messages yet.</p>
          ) : (
            conversations.map((conv) => {
              const cp = conv.p1.id === userId ? conv.p2 : conv.p1;
              const isActive = activeConversationId === conv.id;
              
              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`group flex items-center p-4 rounded-xl cursor-pointer transition-all ${
                    isActive 
                      ? "bg-surface-container-lowest border-l-4 border-secondary shadow-sm" 
                      : "hover:bg-surface-container-high opacity-80"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {cp.avatar_url ? (
                      <img className="w-12 h-12 rounded-full object-cover" src={cp.avatar_url} alt={cp.full_name} />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant font-bold">
                        {cp.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-sm text-primary truncate">{cp.full_name}</span>
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
        <section className={`flex-1 flex flex-col bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(0,10,30,0.06)] overflow-hidden ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          {/* Chat Header */}
          <div className="px-6 md:px-8 py-5 flex items-center gap-4 border-b border-surface-container-low">
            <button className="md:hidden material-symbols-outlined text-on-surface-variant" onClick={() => router.push('/messages')}>arrow_back</button>
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden">
                {peer?.avatar_url ? (
                  <img className="w-full h-full object-cover" src={peer.avatar_url} alt={peer.full_name} />
                ) : (
                  <span className="font-bold text-on-secondary-container">{peer?.full_name?.charAt(0)}</span>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-primary leading-tight">{peer?.full_name}</h2>
              </div>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center space-x-4">
              <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined text-xl">info</span>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            <div className="flex justify-center mb-8">
              <div className="bg-surface-container-low px-4 py-3 rounded-xl flex items-center space-x-3 border border-outline-variant/10">
                <span className="material-symbols-outlined text-secondary">handshake</span>
                <span className="text-xs font-medium text-primary">Connected Deal</span>
                <span className="text-[10px] bg-secondary text-on-secondary px-2 py-0.5 rounded-full uppercase tracking-wider">Active Deal</span>
              </div>
            </div>

            {messages.map((msg) => {
               const isMe = msg.sender_id === userId;
               return (
                  <div key={msg.id} className={`flex flex-col items-${isMe ? "end" : "start"} space-y-1 w-full`}>
                    <div className={`px-5 py-3 rounded-2xl shadow-sm max-w-[80%] ${
                      isMe 
                        ? "bg-primary-container text-on-primary rounded-br-none shadow-md" 
                        : "bg-surface-container-high text-on-surface rounded-bl-none"
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      <span className={`text-[10px] block mt-1 ${isMe ? "text-on-primary-container text-right" : "text-on-surface-variant"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
               )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 md:p-6 bg-surface-container-lowest border-t border-surface-container-low">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-4 bg-surface-container-low rounded-2xl p-2 pl-4 shadow-inner">
              <button type="button" className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">add_circle</button>
              <input 
                type="text" 
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2" 
                placeholder="Write a message..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="bg-primary text-on-primary w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-90 transition-all active:scale-95 disabled:opacity-50" disabled={!newMessage.trim()}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="hidden md:flex flex-1 items-center justify-center bg-surface-container-lowest rounded-xl border border-outline-variant/10 text-on-surface-variant">
          Select a conversation to start messaging
        </section>
      )}
    </div>
  );
}
