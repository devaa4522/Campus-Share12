import { NotificationType } from "@/hooks/useNotifications";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDeepLink(type: NotificationType, data: Record<string, any> | undefined): string {
  const safeData = data || {};
  const routes: Partial<Record<NotificationType, string>> = {
    new_request:      `/dashboard?deal=${safeData.deal_id}`,
    request_accepted: `/dashboard?deal=${safeData.deal_id}&scan=true`,
    qr_handshake:     `/dashboard?deal=${safeData.deal_id}`,
    deal_completed:   `/profile`,
    new_message:      `/messages?id=${safeData.conversation_id}`,
    task_claimed:     `/tasks?task=${safeData.task_id}`,
    karma_received:   `/profile`,
    system:           `/`,
  };
  return routes[type] || '/';
}
