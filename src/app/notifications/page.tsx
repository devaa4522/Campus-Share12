import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import NotificationsClient from "@/components/NotificationsClient";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-full bg-background border-none w-full flex">
      <NotificationsClient />
    </div>
  );
}
