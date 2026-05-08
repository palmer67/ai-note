import { NotesWorkspace } from "@/components/notes/notes-workspace";
import { requireSessionContext } from "@/lib/auth";
import type { Note } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, profile } = await requireSessionContext();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("加载用户笔记失败。");
  }

  return <NotesWorkspace currentProfile={profile} initialNotes={(data as Note[] | null) ?? []} />;
}
