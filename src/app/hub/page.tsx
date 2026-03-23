import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import HubClient from "@/components/HubClient";

export const metadata = { title: "The Hub | The Academic Exchange" };

export default async function HubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <HubClient userId={user.id} />;
}
