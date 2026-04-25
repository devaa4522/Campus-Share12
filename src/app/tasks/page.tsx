import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TasksClient from "@/components/TasksClient";
import type { TaskWithProfile } from "@/lib/types";

export default async function TasksPage(props: {
  searchParams?: Promise<{ task?: string }>;
}) {
  const searchParams = await props.searchParams;
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

  let initialTasks = (tasks ?? []) as unknown as TaskWithProfile[];
  const focusedTaskId = searchParams?.task;

  if (focusedTaskId && !initialTasks.some((task) => task.id === focusedTaskId)) {
    const { data: focusedTask, error: focusedTaskError } = await supabase
      .from("tasks")
      .select("*, profiles:user_id(full_name, avatar_url, degree, year_of_study)")
      .eq("id", focusedTaskId)
      .eq("college_domain", profile.college_domain)
      .maybeSingle();

    if (focusedTaskError) {
      console.error("Error fetching focused task:", focusedTaskError);
    } else if (focusedTask) {
      initialTasks = [focusedTask, ...initialTasks];
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8">
      <TasksClient initialTasks={initialTasks} userId={user.id} focusedTaskId={focusedTaskId} />
    </div>
  );
}
