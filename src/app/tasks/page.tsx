"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { TaskWithProfile } from "@/lib/types";

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [karmaScore, setKarmaScore] = useState(0);
  const [collegeDomain, setCollegeDomain] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    reward_type: "karma" as "karma" | "cash",
    reward_amount: "",
    deadline: "",
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("karma_score, college_domain")
        .eq("id", user.id)
        .single();
      setKarmaScore(profile?.karma_score ?? 0);
      setCollegeDomain(profile?.college_domain ?? null);

      const { data } = await supabase
        .from("tasks")
        .select("*, profiles(*)")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      setTasks((data as TaskWithProfile[]) ?? []);
      setLoading(false);
    });
  }, [router]);

  async function handleClaimTask(taskId: string) {
    if (!userId) return;
    const supabase = createClient();
    // Insert claim
    const { error: claimError } = await supabase.from("task_claims").insert({
      task_id: taskId,
      claimed_by: userId,
    });
    if (claimError) { console.error(claimError); return; }
    // Update task status
    await supabase.from("tasks").update({ status: "claimed" }).eq("id", taskId);
    // Remove from list
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !collegeDomain) return;
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: newTask.title,
        description: newTask.description,
        reward_type: newTask.reward_type,
        reward_amount: parseFloat(newTask.reward_amount) || 0,
        deadline: newTask.deadline ? (new Date(newTask.deadline)).toISOString() : null,
        status: "open",
        college_domain: collegeDomain,
      })
      .select("*, profiles(*)")
      .single();

    if (!error && task) {
      setTasks((prev) => [task as TaskWithProfile, ...prev]);
      setShowModal(false);
      setNewTask({ title: "", description: "", reward_type: "karma", reward_amount: "", deadline: "" });
    } else {
      console.error(error);
    }
    setIsSubmitting(false);
  }

  function formatDeadline(deadline: string | null): string {
    if (!deadline) return "No deadline";
    const d = new Date(deadline);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 0) return "Overdue";
    if (diffMins < 60) return `In ${diffMins} mins`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `In ${diffHrs} hrs`;
    return d.toLocaleDateString();
  }

  function isUrgent(deadline: string | null): boolean {
    if (!deadline) return false;
    const diffMs = new Date(deadline).getTime() - Date.now();
    return diffMs > 0 && diffMs < 3600000; // < 1 hour
  }

  if (loading) {
    return (
      <main className="pt-8 pb-32 px-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-surface-container-high rounded-lg w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 h-80 bg-surface-container-high rounded-xl" />
            <div className="md:col-span-4 h-80 bg-surface-container-high rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-8 pb-32 px-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-5xl font-bold tracking-tight text-primary mb-4">Task Marketplace</h1>
          <p className="font-body text-lg text-on-surface-variant max-w-2xl leading-relaxed">
            Connect with fellow scholars. Trade skills, time, and karma points to keep the campus moving.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="px-6 py-3 bg-secondary text-white font-bold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          Post a Task
        </button>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Featured Task (first task, large bento) */}
        {tasks[0] && (
          <div className="md:col-span-8 group relative overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm transition-all hover:shadow-md">
            <div className="flex flex-col md:flex-row h-full">
              <div className="md:w-1/2 p-8 flex flex-col justify-between">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-semibold uppercase tracking-widest mb-4">
                    Help Needed
                  </span>
                  <h2 className="font-headline text-3xl font-bold text-primary mb-4 leading-tight">{tasks[0].title}</h2>
                  <p className="text-on-surface-variant mb-6">{tasks[0].description}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-outline font-semibold uppercase tracking-wider">Reward</span>
                    <span className="font-bold text-secondary text-xl">
                      {tasks[0].reward_type === "karma" ? `${tasks[0].reward_amount} Karma` : `$${tasks[0].reward_amount?.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-outline font-semibold uppercase tracking-wider">Deadline</span>
                    <span className={`font-medium ${isUrgent(tasks[0].deadline) ? "text-error" : "text-primary"}`}>
                      {formatDeadline(tasks[0].deadline)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="md:w-1/2 relative min-h-[240px] bg-gradient-to-br from-primary/10 to-secondary/10 flex items-end justify-end p-6">
                <button
                  onClick={() => handleClaimTask(tasks[0].id)}
                  className="bg-primary text-white px-8 py-4 rounded-full font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all active:scale-95"
                >
                  <span>I can help</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Side Task 1 */}
        {tasks[1] && (
          <div className="md:col-span-4 p-8 rounded-xl bg-surface-container-low flex flex-col justify-between border border-outline-variant/10">
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-4 ${
                isUrgent(tasks[1].deadline)
                  ? "bg-error-container text-on-error-container"
                  : "bg-surface-container-highest text-on-surface-variant"
              }`}>
                {isUrgent(tasks[1].deadline) ? "Urgent" : "Open"}
              </span>
              <h3 className="font-headline text-2xl font-bold text-primary mb-2">{tasks[1].title}</h3>
              <p className="text-on-surface-variant">{tasks[1].description}</p>
            </div>
            <div className="mt-8">
              <div className="flex justify-between items-end mb-6">
                <div className="flex flex-col">
                  <span className="text-[11px] text-outline font-semibold uppercase tracking-wider">Reward</span>
                  <span className="font-bold text-primary text-lg">
                    {tasks[1].reward_type === "karma" ? `${tasks[1].reward_amount} Karma` : `$${tasks[1].reward_amount?.toFixed(2)}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-outline font-semibold uppercase tracking-wider">Due</span>
                  <p className={`font-medium ${isUrgent(tasks[1].deadline) ? "text-error" : "text-primary"}`}>
                    {formatDeadline(tasks[1].deadline)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleClaimTask(tasks[1].id)}
                className="w-full py-4 border-2 border-primary text-primary rounded-full font-bold hover:bg-primary hover:text-white transition-all active:scale-95"
              >
                Accept Task
              </button>
            </div>
          </div>
        )}

        {/* Dark bento */}
        {tasks[2] && (
          <div className="md:col-span-4 p-8 rounded-xl bg-primary-container text-white flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-secondary-fixed text-4xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
              <h3 className="font-headline text-2xl font-bold mb-2">{tasks[2].title}</h3>
              <p className="text-slate-300">{tasks[2].description}</p>
            </div>
            <div className="mt-8 flex justify-between items-center">
              <span className="font-bold text-secondary-fixed">
                {tasks[2].reward_type === "karma" ? `${tasks[2].reward_amount} Karma` : `$${tasks[2].reward_amount?.toFixed(2)}`}
              </span>
              <button
                onClick={() => handleClaimTask(tasks[2].id)}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-white">add</span>
              </button>
            </div>
          </div>
        )}

        {/* Glass wide bento */}
        {tasks[3] && (
          <div className="md:col-span-8 bg-white/70 backdrop-blur-xl border border-white/40 p-8 rounded-xl flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <span className="inline-block px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold uppercase tracking-widest mb-4">
                Academic Support
              </span>
              <h3 className="font-headline text-2xl font-bold text-primary mb-2">{tasks[3].title}</h3>
              <p className="text-on-surface-variant max-w-md">{tasks[3].description}</p>
            </div>
            <div className="flex flex-col gap-4 w-full md:w-auto">
              <div className="flex items-center justify-between gap-12 bg-surface-container-high px-6 py-4 rounded-full">
                <div>
                  <span className="block text-[10px] text-outline uppercase font-bold tracking-tighter">Reward</span>
                  <span className="font-bold text-primary text-xl">
                    {tasks[3].reward_type === "karma" ? `${tasks[3].reward_amount} Karma` : `$${tasks[3].reward_amount?.toFixed(2)}`}
                  </span>
                </div>
                <button
                  onClick={() => handleClaimTask(tasks[3].id)}
                  className="bg-secondary text-white px-8 py-3 rounded-full font-bold hover:shadow-lg transition-all active:scale-95"
                >
                  I&apos;m Available
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Additional tasks */}
        {tasks.slice(4).map((task) => (
          <div key={task.id} className="md:col-span-4 p-8 rounded-xl bg-surface-container-low border border-outline-variant/10 flex flex-col justify-between">
            <div>
              <h3 className="font-headline text-xl font-bold text-primary mb-2">{task.title}</h3>
              <p className="text-on-surface-variant text-sm mb-4">{task.description}</p>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-secondary">
                {task.reward_type === "karma" ? `${task.reward_amount} Karma` : `$${task.reward_amount?.toFixed(2)}`}
              </span>
              <button
                onClick={() => handleClaimTask(task.id)}
                className="text-sm font-bold text-primary hover:text-secondary transition-colors"
              >
                Claim →
              </button>
            </div>
          </div>
        ))}

        {/* Impact Summary */}
        <div className="md:col-span-12 bg-surface-container-low p-10 rounded-xl border border-outline-variant/20 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h3 className="font-headline text-3xl font-bold text-primary mb-2">Your Impact</h3>
            <p className="text-on-surface-variant">Making a difference on campus, one task at a time.</p>
          </div>
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-full border-4 border-secondary/20 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-secondary">{karmaScore}</span>
              <span className="text-[10px] uppercase font-bold text-outline">Karma</span>
            </div>
          </div>
        </div>

        {tasks.length === 0 && (
          <div className="md:col-span-12 text-center py-20">
            <span className="material-symbols-outlined text-6xl text-outline-variant mb-4 block">assignment</span>
            <h3 className="font-headline text-2xl font-bold text-primary mb-2">No tasks yet</h3>
            <p className="text-on-surface-variant">The marketplace is empty. Check back soon!</p>
          </div>
        )}
      </div>

      {/* Post Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h2 className="font-headline text-2xl font-bold text-primary mb-6">Create a Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Title</label>
                <input
                  required
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3"
                  placeholder="Need help moving a couch"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Description</label>
                <textarea
                  required
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3"
                  placeholder="Help me move my couch from north campus dorms to..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-primary mb-1">Reward Type</label>
                  <select
                    value={newTask.reward_type}
                    onChange={(e) => setNewTask({ ...newTask, reward_type: e.target.value as "karma" | "cash" })}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 appearance-none"
                    style={{ WebkitAppearance: "none", backgroundImage: "none" }}
                  >
                    <option value="karma">Karma</option>
                    <option value="cash">Cash ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-primary mb-1">Amount</label>
                  <input
                    required
                    type="number"
                    value={newTask.reward_amount}
                    onChange={(e) => setNewTask({ ...newTask, reward_amount: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3"
                    placeholder={newTask.reward_type === "cash" ? "20.00" : "150"}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Deadline <span className="font-normal opacity-50 text-xs">(optional)</span></label>
                <input
                  type="datetime-local"
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "Posting..." : "Post Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
