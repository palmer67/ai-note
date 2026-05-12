import { parseTags } from "@/lib/tags";
import type { Note } from "@/lib/types";

function searchItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function getSearchableNoteText(note: Note) {
  const summary = note.ai_summary;

  return [
    note.title,
    note.source_url ?? "",
    parseTags(note.marker).join(" "),
    note.content,
    summary?.topic ?? "",
    summary?.coreArgument ?? "",
    ...searchItems(summary?.supportingEvidence),
    ...searchItems(summary?.bestFitScenarios),
    ...searchItems(summary?.takeaways)
  ]
    .join(" ")
    .toLowerCase();
}
