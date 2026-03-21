import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import type { Item, Profile } from "@/lib/types";
import DashboardClient from "@/components/DashboardClient";

export const metadata = { title: "My Activity" };

export default async function DashboardPage() {
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

  const { data: myItems } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: madeRequests } = await supabase
    .from("item_requests")
    .select("*, items(*, profiles(*))")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });

  const { data: receivedRequests } = await supabase
    .from("item_requests")
    .select("*, items!inner(*), profiles(*)")
    .eq("items.user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: myTaskRequests } = await supabase
    .from("tasks")
    .select("*, task_claims(*, profiles(*))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: helpingWithTasks } = await supabase
    .from("task_claims")
    .select("*, tasks(*, profiles(*))")
    .eq("claimed_by", user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardClient
      profile={profile as Profile}
      items={(myItems ?? []) as Item[]}
      madeRequests={madeRequests ?? []}
      receivedRequests={receivedRequests ?? []}
      myTaskRequests={myTaskRequests ?? []}
      helpingWithTasks={helpingWithTasks ?? []}
    />
  );
}
