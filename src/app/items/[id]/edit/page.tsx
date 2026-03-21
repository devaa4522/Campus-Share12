import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { Item } from "@/lib/types";
import EditItemClient from "@/components/EditItemClient";

export const metadata = { title: "Edit Item | Campus Share" };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: item } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .single();

  if (!item || item.user_id !== user.id) return notFound();

  return <EditItemClient item={item as Item} />;
}
