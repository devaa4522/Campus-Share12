"use client";

import { useState, useEffect, useCallback, useRef, type MouseEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Image from "next/image";
import toast from "react-hot-toast";
import PostTaskModal from "@/components/PostTaskModal";

// Types (inline since lib/types may not export these)
interface TaskProfile {
  full_name?: string | null;
  avatar_url?: string | null;
  degree?: string | null;
  year_of_study?: string | null;
}
interface TaskWithProfile {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  reward_type?: string | null;
  reward_amount?: number | null;
  status: string | null;
  deadline?: string | null;
  college_domain?: string | null;
  created_at: string | null;
  profiles?: TaskProfile | null;
}

// Helpers
function deadlineLabel(deadline: string | null | undefined): { text: string; urgent: boolean } {
  if (!deadline) return { text: "Flexible", urgent: false };
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return { text: "Overdue", urgent: true };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { text: `${mins}m left`, urgent: true };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { text: `${hours}h left`, urgent: true };
  const days = Math.ceil(diff / 86400000);
  return { text: `${days}d left`, urgent: days <= 1 };
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CATEGORY_COLOR: Record<string, string> = {
  Academic:     "bg-primary/10 text-primary",
  Delivery:     "bg-secondary/10 text-secondary",
  "Labor/Help": "bg-blue-100 text-blue-700",
  "Tech Support":"bg-purple-100 text-purple-700",
  General:      "bg-surface-container-high text-on-surface-variant",
};

// Claim confirm bottom sheet
function ClaimSheet({
  task,
  onConfirm,
  onCancel,
  loading,
}: {
  task: TaskWithProfile | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!task) return null;
  const dl = deadlineLabel(task.deadline);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#000a1e]/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-2xl border-t border-outline-variant/10" onClick={(e: MouseEvent) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-outline-variant/40 rounded-full mx-auto mb-5" />

        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary">handshake</span>
          </div>
          <div>
            <h3 className="font-headline font-bold text-primary text-base leading-tight">{task.title}</h3>
            <p className="text-on-surface-variant text-xs mt-0.5">{task.category ?? "General"} · {dl.text}</p>
          </div>
        </div>

        {task.description && (
          <p className="text-on-surface-variant text-sm leading-relaxed mb-4 bg-surface-container rounded-xl p-3">
            {task.description}
          </p>
        )}

        <div className="bg-secondary/10 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">toll</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary/60">You will earn</p>
            <p className="font-headline font-bold text-secondary text-xl">
              {task.reward_amount} {task.reward_type === "karma" ? "CP" : "₹"}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-error/60">Escrow locked</p>
            <p className="font-bold text-error text-sm">{Math.floor((task.reward_amount ?? 0) * 0.1)} CP</p>
          </div>
        </div>

        <p className="text-xs text-on-surface-variant/60 text-center mb-4 leading-relaxed">
          By helping, {Math.floor((task.reward_amount ?? 0) * 0.1)} CP escrow is locked. Cancel within 10 mins for a full refund. Cancelling later incurs the 10% penalty.
        </p>

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 border border-outline-variant/30 text-on-surface-variant py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-[2] bg-primary text-on-primary py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><span className="material-symbols-outlined text-[16px]">handshake</span>I Can Help!</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// Task card
function TaskCard({ task, onClaim, userId }: {
  task: TaskWithProfile;
  onClaim: (task: TaskWithProfile) => void;
  userId: string;
}) {
  const dl = deadlineLabel(task.deadline);
  const catClass = CATEGORY_COLOR[task.category ?? "General"] ?? CATEGORY_COLOR.General;

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden active:scale-[0.99] transition-transform">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${catClass}`}>
                {task.category ?? "General"}
              </span>
              {dl.urgent && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-error/10 text-error flex items-center gap-0.5">
                  <span className="material-symbols-outlined" style={{ fontSize: 9 }}>schedule</span>
                  {dl.text}
                </span>
              )}
              {!dl.urgent && (
                <span className="text-[9px] text-on-surface-variant/50 font-semibold">{dl.text}</span>
              )}
            </div>
            <h3 className="font-headline font-bold text-primary text-base leading-tight">{task.title}</h3>
          </div>
          <div className="text-right shrink-0">
            <p className="font-headline font-bold text-secondary text-lg leading-tight">{task.reward_amount}</p>
            <p className="text-[9px] text-secondary/60 font-bold uppercase tracking-wider">{task.reward_type === "karma" ? "CP" : "₹"}</p>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-on-surface-variant leading-relaxed mb-3 line-clamp-2">{task.description}</p>
        )}

        {/* Poster row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-primary/10 overflow-hidden shrink-0 relative flex items-center justify-center">
            {task.profiles?.avatar_url
              ? <Image src={task.profiles.avatar_url} alt={task.profiles.full_name ?? "User"} fill className="object-cover" />
              : <span className="text-primary font-bold text-xs">{task.profiles?.full_name?.charAt(0)?.toUpperCase() ?? "?"}</span>
            }
          </div>
          <div className="flex-grow min-w-0">
            <p className="text-xs font-semibold text-on-surface truncate">{task.profiles?.full_name ?? "Anonymous"}</p>
            {task.profiles?.degree && (
              <p className="text-[9px] text-on-surface-variant/60 truncate">{task.profiles.degree} {task.profiles.year_of_study ? `· Y${task.profiles.year_of_study}` : ""}</p>
            )}
          </div>
          <span className="text-[9px] text-on-surface-variant/40">{task.created_at ? timeAgo(task.created_at) : ""}</span>
        </div>

        {/* CTA */}
        <button
          onClick={() => onClaim(task)}
          className="w-full bg-primary text-on-primary py-3 rounded-2xl font-bold text-sm uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[16px]">handshake</span>
          I Can Help
        </button>
      </div>
    </div>
  );
}

// Skeleton loader
function TaskSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-4 bg-surface-container-high rounded-full w-24" />
        <div className="h-6 bg-surface-container-high rounded w-12" />
      </div>
      <div className="h-5 bg-surface-container-high rounded w-3/4 mb-2" />
      <div className="h-3 bg-surface-container-high rounded w-full mb-1" />
      <div className="h-3 bg-surface-container-high rounded w-2/3 mb-4" />
      <div className="h-10 bg-surface-container-high rounded-2xl" />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function TasksClient({
  initialTasks,
  userId,
  focusedTaskId,
}: {
  initialTasks: TaskWithProfile[];
  userId: string;
  focusedTaskId?: string;
}) {
  const [tasks, setTasks] = useState<TaskWithProfile[]>(initialTasks);
  const [claimTarget, setClaimTarget] = useState<TaskWithProfile | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Scroll to focused task
  useEffect(() => {
    if (!focusedTaskId) return;
    const t = setTimeout(() => {
      document.getElementById(`task-${focusedTaskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(t);
  }, [focusedTaskId]);

  // Realtime: subscribe to tasks table
  useEffect(() => {
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channelRef.current = (supabase.channel("tasks-feed") as any)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, (payload: { new: TaskWithProfile }) => {
        const newTask = payload.new as TaskWithProfile;
        if (newTask.user_id === userId) return;
        if (newTask.status !== "open") return;
        setTasks((prev: TaskWithProfile[]) => {
          if (prev.some((t: TaskWithProfile) => t.id === newTask.id)) return prev;
          return [newTask, ...prev];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, (payload: { new: TaskWithProfile }) => {
        const updated = payload.new as TaskWithProfile;
        setTasks((prev: TaskWithProfile[]) => {
          if (updated.status !== "open") return prev.filter((t: TaskWithProfile) => t.id !== updated.id);
          return prev.map((t: TaskWithProfile) => t.id === updated.id ? { ...t, ...updated } : t);
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (payload: { old: { id: string } }) => {
        const deleted = payload.old as { id: string };
        setTasks((prev: TaskWithProfile[]) => prev.filter((t: TaskWithProfile) => t.id !== deleted.id));
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // Claim task
  const handleClaim = useCallback(async () => {
    if (!claimTarget) return;
    setClaiming(true);
    try {
      const supabase = createClient();
      // Correct RPC: claim_task_atomic (as documented)
      const { error } = await supabase.rpc("claim_task_atomic", {
        t_id: claimTarget.id,
        u_id: userId,
      });

      if (error) {
        // Friendly mapping of common errors
        if (error.message?.includes("already claimed") || error.message?.includes("not open")) {
          toast.error("This task was just claimed by someone else.");
        } else if (error.message?.includes("karma") || error.message?.includes("escrow")) {
          toast.error("Not enough Karma Points to lock as escrow.");
        } else {
          toast.error(error.message || "Could not claim task. Please try again.");
        }
        setClaiming(false);
        setClaimTarget(null);
        return;
      }
      
      

      toast.success("You're helping! Check your dashboard for details.");
      // Remove the task immediately from the feed — it's no longer "open"
      setTasks((prev: TaskWithProfile[]) => prev.filter((t: TaskWithProfile) => t.id !== claimTarget.id));
      setClaimTarget(null);
    } catch {
      toast.error("Could not claim task. Please try again.");
    } finally {
      setClaiming(false);
    }
  }, [claimTarget]);

  // Filter
  const CATEGORIES = ["All", "Academic", "Delivery", "Labor/Help", "Tech Support", "General"];
  const filtered = filter === "All" ? tasks : tasks.filter((t: TaskWithProfile) => (t.category ?? "General") === filter);

  return (
    <div className="pt-6 pb-32 min-h-full">
      {/* Post Modal */}
      {showPostModal && (
        <PostTaskModal
          userId={userId}
          onClose={() => setShowPostModal(false)}
          onSuccess={(newTask) => {
            setShowPostModal(false);
            // Own task — don't add to feed (they can't help themselves)
          }}
        />
      )}

      {/* Claim confirm sheet */}
      <ClaimSheet
        task={claimTarget}
        onConfirm={handleClaim}
        onCancel={() => setClaimTarget(null)}
        loading={claiming}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">Tasks</h1>
          <p className="text-on-surface-variant text-sm">{tasks.length} open {tasks.length === 1 ? "task" : "tasks"}</p>
        </div>
        <button onClick={() => setShowPostModal(true)}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-2xl font-bold text-sm uppercase tracking-wider active:scale-95 transition-transform flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Post Task
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-1 px-1 pb-1">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap shrink-0 transition-all active:scale-95 ${
              filter === cat ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <TaskSkeleton key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((task: TaskWithProfile) => (
            <div id={`task-${task.id}`} key={task.id}>
              <TaskCard task={task} onClaim={setClaimTarget} userId={userId} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">task_alt</span>
          </div>
          <p className="text-on-surface-variant text-sm mb-4">
            {filter !== "All" ? `No ${filter} tasks right now.` : "No open tasks right now."}
          </p>
          <button onClick={() => setShowPostModal(true)}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform">
            Post a Task
          </button>
        </div>
      )}
    </div>
  );
}
