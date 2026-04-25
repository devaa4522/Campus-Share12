// src/lib/conversation-utils.ts
import type { Conversation } from '@/lib/types';

function getLastMessageTime(conv: Conversation): number {
  if (!conv.messages || conv.messages.length === 0) {
    return conv.created_at ? new Date(conv.created_at).getTime() : 0;
  }
  // Messages are already sorted ascending by the DB query
  return new Date(conv.messages[conv.messages.length - 1].created_at).getTime();
}

/**
 * Sorts conversations by most recent message (newest first).
 * Does NOT deduplicate by peer — each deal has its own conversation thread.
 *
 * Previously this function dropped older conversations with the same peer,
 * which caused data loss when two deals existed between the same two users.
 */
export function deduplicateConversations(
  conversations: Conversation[],
  _userId: string   // kept for API compatibility, no longer used for filtering
): Conversation[] {
  // Remove exact duplicate IDs only (safety net)
  const seen = new Set<string>();
  const unique = conversations.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // Sort: newest activity first
  return unique
    .sort((a, b) => getLastMessageTime(b) - getLastMessageTime(a))
    .map((c) => ({
      ...c,
      messages: c.messages
        ? [...c.messages].sort(
            (x, y) =>
              new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
          )
        : [],
    }));
}