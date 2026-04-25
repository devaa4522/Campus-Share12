// src/lib/send-notification.ts
//
// Deprecated: browser code should not insert notifications directly.
// Business actions should call a server-authoritative RPC, and the RPC/trigger
// should create the notification after validating permissions and state.

type NotificationType =
  | "new_message"
  | "new_request"
  | "request_accepted"
  | "request_rejected"
  | "deal_completed"
  | "task_claimed"
  | "task_completed"
  | "karma_received"
  | "karma_penalty"
  | "qr_handshake"
  | "system";

interface SendNotificationParams {
  userId: string;
  senderId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendNotification(_params: SendNotificationParams): Promise<void> {
  console.warn(
    "[sendNotification] Direct client notification inserts are disabled. " +
    "Create notifications inside validated Supabase RPCs or database triggers instead."
  );
}
