import { getSearchableNoteText } from "@/lib/notes/search";
import { parseTags } from "@/lib/tags";
import type { Note, NoteDraft } from "@/lib/types";
import type { NoteLifecycleView } from "@/lib/note-lifecycle";

export const blankDraft: NoteDraft = {
  title: "",
  source_url: "",
  tags: [],
  content: ""
};

export function toDraft(note: Note | null): NoteDraft {
  if (!note) {
    return blankDraft;
  }

  return {
    title: note.title,
    source_url: note.source_url ?? "",
    tags: parseTags(note.marker),
    content: note.content
  };
}

export function sortNotes(notes: Note[]) {
  return [...notes].sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
}

export function matchesSearch(note: Note, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return getSearchableNoteText(note).includes(normalized);
}

export function getFilteredNotes(
  notes: Note[],
  query: string,
  tag: string | null,
  lifecycleView: NoteLifecycleView
) {
  return notes.filter((note) => {
    const matchesKeywordSearch = matchesSearch(note, query);
    const matchesTagFilter = tag ? parseTags(note.marker).includes(tag) : true;
    const matchesLifecycleView = lifecycleView === "all" || note.lifecycle_status === lifecycleView;

    return matchesKeywordSearch && matchesTagFilter && matchesLifecycleView;
  });
}

export function getAvailableTags(notes: Note[]) {
  return Array.from(new Set(notes.flatMap((note) => parseTags(note.marker)))).sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  );
}

export function getCollectionNotes(notes: Note[], selectedCollectionIds: string[]) {
  return selectedCollectionIds
    .map((id) => notes.find((note) => note.id === id))
    .filter((note): note is Note => Boolean(note));
}
