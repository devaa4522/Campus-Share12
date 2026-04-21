"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import toast from "react-hot-toast";

export default function PostTaskModal({ onClose, onSuccess, userId }: { onClose: () => void, onSuccess: (task: unknown) => void, userId: string }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [deadline, setDeadline] = useState("Today");
  const [description, setDescription] = useState("");
  const [rewardType, setRewardType] = useState<"cash" | "karma">("cash");
  const [rewardAmount, setRewardAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !rewardAmount) {
      toast.error("Please fill in all details");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("college_domain")
        .eq("id", userId)
        .single();
        
      if (!profile?.college_domain) throw new Error("No college domain found in profile");

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title,
          category,
          deadline,
          description,
          reward_type: rewardType,
          reward_amount: parseFloat(rewardAmount),
          college_domain: profile.college_domain,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Task posted successfully!");
      onSuccess(data);
      onClose();

    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to post task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-primary-container/40 backdrop-blur-md" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-surface rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Modal Header */}
        <div className="bg-primary-container px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="font-headline text-2xl text-surface-bright font-bold">Post a Task</h2>
            <p className="text-on-primary-container text-sm">Define your request for the campus community.</p>
          </div>
          <button onClick={onClose} className="text-on-primary-container hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Title Field */}
          <div className="space-y-2">
            <label className="block font-headline text-sm font-bold text-primary-container">Task Title</label>
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all placeholder:text-outline/50" 
              placeholder="e.g., Return library books" 
              type="text"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div className="space-y-2">
              <label className="block font-headline text-sm font-bold text-primary-container">Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all appearance-none cursor-pointer"
              >
                <option>General</option>
                <option>Delivery</option>
                <option>Academic</option>
                <option>Labor/Help</option>
                <option>Tech Support</option>
              </select>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <label className="block font-headline text-sm font-bold text-primary-container">Deadline</label>
              <div className="flex gap-2">
                {["30m", "1hr", "Today"].map(d => (
                  <label key={d} className="flex-1 cursor-pointer">
                    <input 
                      checked={deadline === d}
                      onChange={() => setDeadline(d)}
                      className="hidden peer" 
                      name="deadline" 
                      type="radio"
                    />
                    <div className="text-center py-3 border border-outline-variant/20 rounded-lg peer-checked:bg-primary-container peer-checked:text-white peer-checked:border-primary-container transition-all text-xs font-bold uppercase tracking-wider">
                      {d}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block font-headline text-sm font-bold text-primary-container">Description</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all placeholder:text-outline/50" 
              placeholder="Describe what needs to be done..." 
              rows={3}
            />
          </div>

          {/* Rewards */}
          <div className="p-6 bg-surface-container-low rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <label className="block font-headline text-sm font-bold text-primary-container">Reward Details</label>
              <div className="flex bg-surface rounded-full p-1 border border-outline-variant/20">
                <button 
                  onClick={() => setRewardType("cash")}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    rewardType === "cash" ? "bg-primary-container text-white" : "text-on-surface-variant hover:bg-surface-container-high"
                  }`} 
                  type="button"
                >
                  Cash
                </button>
                <button 
                  onClick={() => setRewardType("karma")}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    rewardType === "karma" ? "bg-primary-container text-white" : "text-on-surface-variant hover:bg-surface-container-high"
                  }`} 
                  type="button"
                >
                  Karma
                </button>
              </div>
            </div>
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-container font-bold text-lg">
                {rewardType === "cash" ? "$" : "KP"}
              </span>
              <input 
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                required
                className="w-full bg-surface border border-outline-variant/20 rounded-lg pl-12 pr-4 py-4 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all text-2xl font-headline font-bold text-primary-container" 
                placeholder="0.00" 
                type="number"
                min="0"
                step={rewardType === 'cash' ? "0.01" : "1"}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button 
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 border border-outline-variant/30 py-4 rounded-lg font-bold text-primary-container hover:bg-surface-container-low transition-all active:scale-95 disabled:opacity-50" 
              type="button"
            >
              Cancel
            </button>
            <button 
              disabled={isSubmitting}
              className="flex-[2] bg-primary-container py-4 rounded-lg font-bold text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center" 
              type="submit"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : 'Post Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
