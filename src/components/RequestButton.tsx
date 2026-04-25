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

    // Get item details + owner info
    const { data: item } = await supabase
      .from("items")
      .select("id, title, user_id, profiles(full_name, avatar_url)")
      .eq("id", itemId)
      .single();

    if (!item) {
      toast.error("Item not found.");
      setLoading(false);
      return;
    }

    // Insert request
    const { data: request, error } = await supabase
      .from("item_requests")
      .insert({
        item_id:      itemId,
        requester_id: user.id,
        duration_days: 7,
        status:       "pending",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      toast.error("Failed to send request.");
      setLoading(false);
      return;
    }

    toast.success("Request sent! The lender will be notified.");

    // ⭐ Notify the item owner
    if (item.user_id && item.user_id !== user.id) {
      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      await supabase.from("notifications").insert({
        user_id:   item.user_id,          // Notify the OWNER
        sender_id: user.id,               // Requester is the sender
        type:      "new_request",
        title:     `${requesterProfile?.full_name ?? "Someone"} wants to borrow`,
        body:      `"${item.title}" — Tap to view the request`,
        data: {
          deal_id:  request.id,
          item_id:  itemId,
          item_title: item.title,
          url:      `/dashboard?deal=${request.id}`,
        },
        is_read: false,
      });
    }

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