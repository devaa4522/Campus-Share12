import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import type { ComponentProps } from "react";
import type { Item, Profile } from "@/lib/types";
import DashboardClient from "@/components/DashboardClient";

type DashboardClientProps = ComponentProps<typeof DashboardClient>;

export const metadata = { title: "My Activity" };

export default async function DashboardPage(props: {
  searchParams?: Promise<{ deal?: string; type?: string; tab?: string; scan?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: myItems },
    { data: madeRequests },
    { data: receivedRequests },
    { data: myTaskRequests },
    { data: helpingWithTasks }
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("item_requests").select("*, items(*, profiles(*))").eq("requester_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("item_requests")
      .select("*, items!inner(*), profiles(*)")
      .eq("items.user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("tasks").select("*, task_claims(*, profiles(*))").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("task_claims").select("*, tasks(*, profiles(*))").eq("claimed_by", user.id).order("created_at", { ascending: false })
  ]);

  if (!profile) redirect("/onboarding");

  return (
    <DashboardClient
      profile={profile as Profile}
      items={(myItems ?? []) as Item[]}
      madeRequests={(madeRequests ?? []) as unknown as DashboardClientProps["madeRequests"]}
      receivedRequests={(receivedRequests ?? []) as unknown as DashboardClientProps["receivedRequests"]}
      myTaskRequests={(myTaskRequests ?? []) as unknown as DashboardClientProps["myTaskRequests"]}
      helpingWithTasks={(helpingWithTasks ?? []) as unknown as DashboardClientProps["helpingWithTasks"]}
      focusedDealId={searchParams?.deal}
      focusedDealType={searchParams?.type === "task" ? "task" : searchParams?.type === "item" ? "item" : undefined}
      initialTab={searchParams?.tab as DashboardClientProps["initialTab"]}
      openScanner={searchParams?.scan === "true"}
    />
  );
}
