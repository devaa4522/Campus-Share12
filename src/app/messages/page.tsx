import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import MessageCenterClient from "@/components/MessageCenterClient";
import type { Conversation } from "@/lib/types";

export default async function MessagesPage(props: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const searchParams = await props.searchParams;
  const activeId = searchParams?.id;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all conversations for the user
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(`
      id,
      deal_id,
      participant_1,
      participant_2,
      created_at,
      p1:profiles!participant_1(id, full_name, avatar_url),
      p2:profiles!participant_2(id, full_name, avatar_url),
      messages(id, content, created_at, sender_id, is_read)
    `)
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching conversations:", error);
  }

  return (
    <div className="bg-[#f7f9fb] font-body text-[#000a1e] flex flex-col h-full w-full">
      <MessageCenterClient
        initialConversations={conversations as unknown as Conversation[]}
        activeConversationId={activeId}
        userId={user.id}
      />
    </div>
  );
}
