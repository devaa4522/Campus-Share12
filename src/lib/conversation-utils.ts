import type { Conversation } from "@/lib/types";

// This is the shape expected from the joined query
export type ConvRecord = Conversation & {
  [key: string]: unknown;
};

// src/lib/conversation-utils.ts
function getLastTime(conv: Conversation): number {
  const msgDate = conv.messages && conv.messages.length > 0
    ? conv.messages[conv.messages.length - 1].created_at
    : conv.created_at;
    
  return msgDate ? new Date(msgDate).getTime() : Date.now();
}

export function deduplicateConversations(initialConversations: Conversation[], userId: string): Conversation[] {
  const dedupedMap = initialConversations.reduce<Record<string, Conversation>>((acc, conv) => {
    const peerId = conv.p1.id === userId ? conv.p2.id : conv.p1.id;
    const currentLastTime = getLastTime(conv);

    if (!acc[peerId] || currentLastTime > getLastTime(acc[peerId])) {
      acc[peerId] = conv;
    }
    return acc;
  }, {});

  return (Object.values(dedupedMap))
    .sort((a, b) => getLastTime(b) - getLastTime(a))
    .map(c => ({
      ...c,
      messages: c.messages
        ? [...c.messages].sort(
            (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
          )
        : [],
    }));
}
