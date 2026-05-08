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

  const notes = ((data as Note[] | null) ?? []).map((note) =>
    note.ai_status === "loading"
      ? {
          ...note,
          ai_status: "error" as const
        }
      : note
  );

  const staleLoadingIds = ((data as Note[] | null) ?? [])
    .filter((note) => note.ai_status === "loading")
    .map((note) => note.id);

  if (staleLoadingIds.length) {
    await supabase.from("notes").update({ ai_status: "error" }).in("id", staleLoadingIds);
  }

  return <NotesWorkspace currentProfile={profile} initialNotes={notes} />;
}
