"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import toast from "react-hot-toast";
import Image from "next/image";
import PostTaskModal from "./PostTaskModal";

import { TaskWithProfile } from "@/lib/types";

export default function TasksClient({ initialTasks, userId }: { initialTasks: TaskWithProfile[]; userId: string }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeCategory, setActiveCategory] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const supabase = createClient();

  const categories = ["All", "Delivery", "Academic", "Labor/Help", "Tech Support", "General"];

  useEffect(() => {
    // Name the channel per-user to avoid collisions on hot reload
    const channel = supabase
      .channel(`tasks-feed-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        const newTask = payload.new as TaskWithProfile;
        if (newTask.status === 'open' && newTask.user_id !== userId) {
          setTasks(prev => [newTask, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const updatedTask = payload.new as TaskWithProfile;
        setTasks(prev => {
          if (updatedTask.status !== 'open') {
            return prev.filter(t => t.id !== updatedTask.id);
          }
          return prev.map(t => t.id === updatedTask.id ? updatedTask : t);
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        const deletedId = (payload.old as { id: string }).id;
        setTasks(prev => prev.filter(t => t.id !== deletedId));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId]);

  const filteredTasks = activeCategory === "All" 
    ? tasks 
    : tasks.filter(t => t.category === activeCategory);

  const getColSpanCount = (index: number) => {
    const pattern = ["md:col-span-4", "md:col-span-2", "md:col-span-3", "md:col-span-3", "md:col-span-6"];
    return pattern[index % pattern.length];
  };

  const handleClaimTask = async (task: TaskWithProfile) => {
    try {
      setClaimingId(task.id);
      
      const { data: result, error: rpcError } = await supabase.rpc('claim_task_atomic', {
        t_id: task.id,
        u_id: userId
      });

      if (rpcError) throw rpcError;

      const convId = result?.conversation_id;
      if (!convId) throw new Error("Conversation generation failed");

      // Insert system message
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: userId,
          content: `I'm here to help with your task: ${task.title}`
        });

      if (msgError) throw msgError;

      toast.success("Task claimed! Opening message thread...");
      router.push(`/messages?id=${convId}`);
      
    } catch {
      toast.error("Action could not be completed. We are working on a fix.");
      setClaimingId(null);
    }
  };

  const handleTaskPosted = () => {
    // Optimistic insert to the feed so user sees it, though they can't claim it.
    // Actually, prompt says "exclude tasks created by current user", but it is their task.
    // Let's reload to just get fresh status, or not show it since it's theirs.
    router.refresh();
  };

  return (
    <div className="pt-8 pb-32">
      <header className="mb-10">
        <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-primary mb-4">Task Marketplace</h1>
        <p className="text-on-surface-variant max-w-2xl text-lg">Support your peers, earn rewards, and strengthen the institutional community.</p>
      </header>

      {/* Category Filter */}
      <div className="flex overflow-x-auto hide-scrollbar gap-3 mb-10 pb-2">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2.5 rounded-full font-medium text-sm whitespace-nowrap shadow-sm transition-colors ${
              activeCategory === cat 
                ? "bg-primary text-on-primary" 
                : "bg-surface-container-lowest text-on-surface border border-outline-variant/30 hover:bg-surface-container-low"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {filteredTasks.map((task, index) => {
          const colSpan = getColSpanCount(index);
          const isLarge = colSpan === "md:col-span-4" || colSpan === "md:col-span-6";
          const rewardLabel = task.reward_type === 'cash' ? `$${task.reward_amount}` : `${task.reward_amount} Karma`;

          return (
            <div key={task.id} className={`${colSpan} glass-card p-6 md:p-8 rounded-xl shadow-[0_12px_32px_rgba(0,10,30,0.06)] flex flex-col justify-between transition-all hover:translate-y-[-4px] bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-slate-800/40 min-h-[280px]`}>
              <div>
                <div className="flex justify-between items-start mb-6">
                  {task.category && (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">{task.category}</span>
                  )}
                  <span className={`${task.reward_type === 'cash' ? 'text-secondary font-bold text-sm' : 'bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold'}`}>
                    {rewardLabel}
                  </span>
                </div>
                <h3 className={`font-headline font-bold text-primary mb-3 ${isLarge ? 'text-3xl' : 'text-xl'}`}>{task.title}</h3>
                <p className="text-on-surface-variant text-sm md:text-base line-clamp-3 mb-6 leading-relaxed">
                  {task.description}
                </p>
                {task.deadline && (
                  <div className="flex items-center gap-1 text-xs text-on-surface-variant mb-4">
                    <span className="material-symbols-outlined text-[14px]">schedule</span> 
                    Deadline: {task.deadline}
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-outline-variant/10">
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface-container-highest overflow-hidden">
                    {task.profiles?.avatar_url ? (
                      <Image src={task.profiles.avatar_url} alt="Avatar" fill sizes="40px" className="object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-xs font-bold text-on-surface-variant">
                        {(task.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-xs md:text-sm text-primary">Req. by {task.profiles?.full_name}</span>
                </div>
                <button 
                  onClick={() => handleClaimTask(task)}
                  disabled={claimingId === task.id}
                  className="bg-primary text-on-primary px-5 py-2.5 md:px-8 md:py-3 rounded-xl font-semibold hover:bg-primary-container transition-all active:scale-95 shadow-lg disabled:opacity-50 text-sm md:text-base"
                >
                  {claimingId === task.id ? 'Claiming...' : 'I Can Help'}
                </button>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="col-span-full py-20 text-center">
             <div className="inline-flex p-4 rounded-full bg-surface-container-low mb-4">
               <span className="material-symbols-outlined text-4xl text-on-surface-variant">inbox</span>
             </div>
             <h3 className="text-xl font-headline font-bold text-primary">No tasks found</h3>
             <p className="text-on-surface-variant mt-2">Check back later or post your own task!</p>
          </div>
        )}
      </div>

      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-6 md:bottom-12 md:right-12 bg-secondary text-on-secondary w-16 h-16 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl active:scale-90 transition-transform z-40"
      >
        <span className="material-symbols-outlined text-3xl font-variation-settings-fill-0">add</span>
      </button>

      {isModalOpen && (
        <PostTaskModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handleTaskPosted}
          userId={userId}
        />
      )}
    </div>
  );
}
