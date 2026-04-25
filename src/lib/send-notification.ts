// src/lib/send-notification.ts
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

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
  // Who receives the notification
  userId: string;
  // Who triggered it (for name/avatar lookup)
  senderId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendNotification({
  userId,
  senderId,
  type,
  title,
  body,
  data = {},
}: SendNotificationParams): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id:   userId,
      sender_id: senderId,  // ⭐ triggers enrichment in DB trigger
      type,
      title,
      body,
      data,
      is_read: false,
    });

    if (error) {
      console.error("[sendNotification] Failed:", error);
    }
  } catch (err) {
    console.error("[sendNotification] Error:", err);
  }
}