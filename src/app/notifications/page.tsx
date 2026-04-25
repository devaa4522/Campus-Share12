// src/app/notifications/page.tsx
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import NotificationsClient from "@/components/NotificationsClient";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  /*
   * The outer div must NOT have min-h-full or overflow constraints —
   * NotificationsClient owns its own height via h-[100dvh].
   * We just need a full-width flex container.
   */
  return (
    <div className="h-full w-full flex bg-surface min-h-0">
      <NotificationsClient />
    </div>
  );
}