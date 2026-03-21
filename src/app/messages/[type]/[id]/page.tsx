import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ChatRoomClient from "@/components/ChatRoomClient";

export default async function MessageThreadPage({ params }: { params: Promise<{ type: string, id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { type, id } = await params;

  let missionContext = null;

  if (type === "task") {
    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        poster:profiles!user_id(id, full_name, avatar_url),
        task_claims(claimed_by, profiles:profiles!claimed_by(id, full_name, avatar_url))
      `)
      .eq("id", id)
      .single();

    if (error || !task) {
      redirect("/tasks");
    }

    const claim = task.task_claims?.[0];
    const isPoster = user.id === task.user_id;
    const isClaimer = claim && user.id === claim.claimed_by;

    if (!isPoster && !isClaimer) {
      redirect("/tasks");
    }

    const peer = isPoster ? claim?.profiles : task.poster;

    missionContext = {
      title: task.title,
      status: task.status === "claimed" ? "In Progress" : task.status,
      icon: "task_alt",
      type: "Task",
      peerName: peer?.full_name || "Unknown Sender",
      peerAvatar: peer?.avatar_url,
    };

  } else if (type === "request") {
    const { data: req, error } = await supabase
      .from("item_requests")
      .select(`
        *,
        items!inner(*, owner:profiles!user_id(id, full_name, avatar_url)),
        requester:profiles!requester_id(id, full_name, avatar_url)
      `)
      .eq("id", id)
      .single();

    if (error || !req) {
      redirect("/dashboard");
    }

    const isLender = user.id === req.items.user_id;
    const isRequester = user.id === req.requester_id;

    if (!isLender && !isRequester) {
      redirect("/dashboard"); 
    }

    const peer = isLender ? req.requester : req.items.owner;

    missionContext = {
      title: req.items.title,
      status: req.status === "accepted" ? "Active Deal" : "Pending",
      icon: "handshake",
      type: "Item Request",
      peerName: peer?.full_name || "Unknown Sender",
      peerAvatar: peer?.avatar_url,
    };
  } else {
    redirect("/");
  }

  const column = type === "task" ? "task_id" : "request_id";
  const { data: initialMessages } = await supabase
    .from("messages")
    .select("*")
    .eq(column, id)
    .order("created_at", { ascending: true });


  return (
    <div className="min-h-screen bg-background pt-20">
       <ChatRoomClient 
          initialMessages={initialMessages || []}
          userId={user.id}
          dealId={id}
          dealType={type as "task" | "request"}
          mission={missionContext}
       />
    </div>
  );
}
