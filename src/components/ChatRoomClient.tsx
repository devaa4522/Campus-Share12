"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ChatRoomClient({
  initialMessages,
  userId,
  dealId,
  dealType,
  mission
}: {
  initialMessages: any[];
  userId: string;
  dealId: string;
  dealType: "task" | "request";
  mission: any;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const column = dealType === "task" ? "task_id" : "request_id";
    
    const channel = supabase
      .channel(`room:${dealId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `${column}=eq.${dealId}`
        },
        (payload) => {
          const newMsg = payload.new;
          setMessages(prev => {
            // Check if it already exists to prevent duplicate renders from our own optimistic setup if we add it
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, dealType, supabase]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;

    const column = dealType === "task" ? "task_id" : "request_id";
    const textToSend = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase
      .from("messages")
      .insert({
        [column]: dealId,
        sender_id: userId,
        content: textToSend,
      });

    if (error) {
      console.error("Failed to send message", error);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header Context */}
      <header className="bg-slate-50/85 dark:bg-slate-950/85 backdrop-blur-lg shadow-sm border-b border-slate-200/20 dark:border-slate-800/20 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                {mission.peerAvatar ? (
                    <img src={mission.peerAvatar} alt="Peer" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-on-surface-variant">
                        {mission.peerName.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-secondary border-2 border-surface rounded-full"></div>
              </div>
              <div>
                <h1 className="text-primary font-headline font-bold text-lg tracking-tight leading-none">{mission.peerName}</h1>
                <p className="text-[11px] font-label text-on-surface-variant uppercase tracking-widest mt-0.5">{mission.type}: {mission.title}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Canvas */}
      <main className="max-w-3xl mx-auto w-full flex-1 overflow-y-auto p-6 flex flex-col gap-6 scroll-smooth">
        
        {/* Mission Bento Card Context */}
        <div className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-sm flex items-start gap-4 mb-4">
          <div className="bg-primary-container p-3 rounded-xl">
            <span className="material-symbols-outlined text-primary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>
              {mission.icon}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-primary">{mission.title}</h3>
            <p className="text-on-surface-variant text-sm mt-1">Status: <span className="text-secondary font-medium">{mission.status}</span></p>
          </div>
        </div>

        {/* Messages */}
        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === userId;
          
          if (isMe) {
            return (
              <div key={msg.id || idx} className="flex flex-col gap-1 items-end self-end max-w-[85%]">
                <div className="bg-primary-container text-surface-container-lowest p-4 rounded-xl rounded-tr-none">
                  <p className="text-base">{msg.content}</p>
                </div>
                <div className="flex items-center gap-1 px-1">
                  <span className="text-[10px] text-on-surface-variant font-label">{formatTime(msg.created_at)}</span>
                  <span className="material-symbols-outlined text-[12px] text-on-surface-variant">done</span>
                </div>
              </div>
            );
          } else {
            return (
              <div key={msg.id || idx} className="flex flex-col gap-1 items-start max-w-[85%]">
                <div className="bg-surface-container-high text-on-surface p-4 rounded-xl rounded-tl-none">
                  <p className="text-base">{msg.content}</p>
                </div>
                <span className="text-[10px] text-on-surface-variant font-label px-1">{formatTime(msg.created_at)}</span>
              </div>
            );
          }
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="w-full bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200/30 dark:border-slate-800/30 py-4 px-6 flex-shrink-0">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-3">
          <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-all active:scale-90">
            <span className="material-symbols-outlined">add_circle</span>
          </button>
          <div className="flex-1 relative flex items-center">
            <input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-full py-3 px-6 text-on-surface placeholder:text-on-surface-variant/60 focus:ring-1 focus:ring-primary-container font-body text-sm transition-all outline-none" 
              placeholder="Type your message..." 
              type="text"
            />
          </div>
          <button type="submit" disabled={!newMessage.trim()} className="w-10 h-10 flex items-center justify-center bg-primary-container text-surface-container-lowest rounded-full shadow-sm hover:shadow-md transition-all active:scale-90 disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </button>
        </form>
      </footer>
    </div>
  );
}
