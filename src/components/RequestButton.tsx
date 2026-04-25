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
  const router  = useRouter();
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

    const { error } = await supabase.rpc("request_item", {
      p_item_id: itemId,
      p_duration_days: 7,
    });

    if (error) {
      console.error(error);
      toast.error(error.message || "Failed to send request.");
      setLoading(false);
      return;
    }

    toast.success("Request sent! The lender will be notified.");
    setLoading(false);
    router.refresh();
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
