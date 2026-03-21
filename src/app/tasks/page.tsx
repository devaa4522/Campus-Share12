giimport { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TasksClient from "@/components/TasksClient";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_domain")
    .eq("id", user.id)
    .single();

  if (!profile?.college_domain) {
    redirect("/onboarding");
  }

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*, profiles:user_id(full_name, avatar_url, degree, year_of_study)")
    .eq("college_domain", profile.college_domain)
    .eq("status", "open")
    .neq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tasks:", error);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8">
      <TasksClient initialTasks={tasks || []} userId={user.id} />
    </div>
  );
}
