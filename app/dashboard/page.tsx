import { NotesWorkspace } from "@/components/notes/notes-workspace";
import { requireSessionContext } from "@/lib/auth";
import type { Note, NoteCollectionItem, SavedNoteCollection } from "@/lib/types";

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

  const { data: collectionData, error: collectionError } = await supabase
    .from("note_collections")
    .select("*")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false });

  if (collectionError) {
    throw new Error("加载保存资料集失败。");
  }

  const collectionRows = ((collectionData as Omit<SavedNoteCollection, "note_ids">[] | null) ?? []);
  let collectionItemRows: NoteCollectionItem[] = [];

  if (collectionRows.length) {
    const { data: collectionItemData, error: collectionItemError } = await supabase
      .from("note_collection_items")
      .select("*")
      .in(
        "collection_id",
        collectionRows.map((collection) => collection.id)
      )
      .order("position", { ascending: true });

    if (collectionItemError) {
      throw new Error("加载资料集内容失败。");
    }

    collectionItemRows = (collectionItemData as NoteCollectionItem[] | null) ?? [];
  }

  const savedCollections: SavedNoteCollection[] = collectionRows.map((collection) => ({
    ...collection,
    note_ids: collectionItemRows
      .filter((item) => item.collection_id === collection.id)
      .sort((left, right) => left.position - right.position)
      .map((item) => item.note_id)
  }));

  // 如果服务重启或请求中断导致 ai_status 卡在 loading，
  // 页面加载时先把它修正成 error，避免用户一直看到“分析中”假状态。
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

  return <NotesWorkspace currentProfile={profile} initialNotes={notes} initialCollections={savedCollections} />;
}
