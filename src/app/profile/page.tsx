import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProfileClient from "@/components/ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const { count } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Fetch recent exchanges (completed item_requests)
  const { data: recentRequests } = await supabase
    .from("item_requests")
    .select("*, items(*)")
    .or(`requester_id.eq.${user.id},items.user_id.eq.${user.id}`)
    .in("status", ["completed", "returning"])
    .order("created_at", { ascending: false })
    .limit(5);

  interface ItemRequest {
    id: string;
    status: string;
    created_at: string;
    items: {
      category: string | null;
    } | null;
  }

  // Construct category reliability based on successful trades
  const categoryReliability: Record<string, number> = {};
  if (recentRequests) {
    (recentRequests as unknown as ItemRequest[]).forEach((req) => {
      const cat = req.items?.category || "General";
      categoryReliability[cat] = (categoryReliability[cat] || 0) + 1;
    });
  }

  // Convert map to array format for easy mapping
  const reliableCategories = Object.keys(categoryReliability).map(cat => ({
    name: cat,
    count: categoryReliability[cat]
  })).sort((a, b) => b.count - a.count);

  // Scrub Supabase objects to plain JSON to prevent NEXT_RSC_ERR_ENQUEUE_MODEL
  const safeProfile = JSON.parse(JSON.stringify(profile));
  const safeExchanges = JSON.parse(JSON.stringify(recentRequests || []));

  return (
    <ProfileClient
      profile={safeProfile}
      email={user.email ?? ""}
      itemCount={count ?? 0}
      recentExchanges={safeExchanges}
      reliableCategories={reliableCategories}
    />
  );
}
