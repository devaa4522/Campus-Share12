"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import toast from "react-hot-toast";

export default function RequestButton({
  isLoggedIn,
  itemId,
}: {
  isLoggedIn: boolean;
  itemId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to request items.");
      setLoading(false);
      return;
    }

    // Insert request
    const { error } = await supabase
      .from("item_requests")
      .insert({
        item_id: itemId,
        requester_id: user.id,
        duration_days: 7, // default
        status: "pending",
      });

    if (error) {
      console.error(error);
      toast.error("Failed to send request.");
    } else {
      toast.success("Request sent! The lender will be notified.");
    }
    
    setLoading(false);
  }

  return (
    <button
      onClick={handleRequest}
      disabled={loading}
      className="w-full md:w-auto px-10 py-5 bg-primary text-white text-sm font-bold tracking-[0.15em] uppercase rounded-xl shadow-2xl hover:bg-primary-container transition-all flex items-center justify-center gap-3 disabled:opacity-50"
    >
      {loading ? "Requesting..." : "Request to Borrow"}
      <span className="material-symbols-outlined">arrow_forward</span>
    </button>
  );
}
