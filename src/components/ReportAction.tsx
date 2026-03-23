"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import toast from "react-hot-toast";

export default function ReportAction({
  targetUserId,
  itemId,
}: {
  targetUserId: string;
  itemId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReport = async (reason: string) => {
    setLoading(true);
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to report.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_id: targetUserId,
      item_id: itemId || null,
      reason: reason
    });

    if (error) {
      toast.error("Failed to submit report. Please try again.");
    } else {
      toast.success("Report submitted securely. Campus Admins will review within 24 hours.");
      setIsOpen(false);
    }
    setLoading(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-outline-variant/30 text-outline hover:text-[#ba1a1a] hover:border-[#ba1a1a]/50 hover:bg-[#ba1a1a]/5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95 duration-200"
      >
        <span className="material-symbols-outlined text-sm">report</span>
        Report User or Item
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000a1e]/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-outline-variant/30">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
              <h2 className="text-xl font-bold text-[#000a1e] font-headline">Report Issue</h2>
              <button onClick={() => setIsOpen(false)} className="text-outline hover:text-[#000a1e] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-on-surface-variant font-medium">Select the reason for reporting this listing or user:</p>
              
              <div className="space-y-2">
                <button 
                  disabled={loading}
                  onClick={() => handleReport("Inaccurate Listing")}
                  className="w-full text-left px-4 py-3 rounded-lg border border-outline-variant/30 hover:bg-surface-container hover:border-[#000a1e]/30 transition-all flex items-center justify-between group disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-[#000a1e]">Inaccurate Listing</span>
                  <span className="material-symbols-outlined text-outline group-hover:text-[#000a1e]">chevron_right</span>
                </button>
                
                <button 
                  disabled={loading}
                  onClick={() => handleReport("Unresponsive")}
                  className="w-full text-left px-4 py-3 rounded-lg border border-outline-variant/30 hover:bg-surface-container hover:border-[#000a1e]/30 transition-all flex items-center justify-between group disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-[#000a1e]">Unresponsive</span>
                  <span className="material-symbols-outlined text-outline group-hover:text-[#000a1e]">chevron_right</span>
                </button>
                
                <button 
                  disabled={loading}
                  onClick={() => handleReport("Safety Concern")}
                  className="w-full text-left px-4 py-3 rounded-lg border border-outline-variant/30 hover:bg-error/5 hover:border-error/30 transition-all flex items-center justify-between group disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-[#ba1a1a]">Safety Concern</span>
                  <span className="material-symbols-outlined text-[#ba1a1a] opacity-50 group-hover:opacity-100">warning</span>
                </button>
              </div>
              
              <p className="text-[11px] text-outline italic mt-4">
                Reports are confidential and reviewed by the Campus Academic Board within 24 hours. Multiple violations will result in automatic shadowbans.
              </p>
            </div>
            
            <div className="p-4 bg-surface-container-low flex justify-end">
              <button disabled={loading} onClick={() => setIsOpen(false)} className="px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-[#000a1e] hover:bg-surface-container-highest transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
