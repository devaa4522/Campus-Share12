// src/app/messages/page.tsx
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import MessageCenterLoader from "@/components/MessageCenterLoader";
import type { Conversation } from "@/lib/types";

export default async function MessagesPage(props: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const searchParams = await props.searchParams;
  const activeId     = searchParams?.id;
  const supabase     = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
      messages(
        id,
        content,
        created_at,
        sender_id,
        is_read,
        msg_type,
        reply_to_id,
        is_deleted,
        is_edited,
        reactions
      )
    `)
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order("created_at", { referencedTable: "messages", ascending: true });

  if (error) console.error("[MessagesPage] fetch error:", error);

  return (
    <div className="h-full w-full overflow-hidden">
      <MessageCenterLoader
        initialConversations={(conversations ?? []) as unknown as Conversation[]}
        activeConversationId={activeId}
        userId={user.id}
      />
    </div>
  );
}