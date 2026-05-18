import { parseTags } from "@/lib/tags";
import type { Note } from "@/lib/types";

function searchItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  // AI 摘要是 jsonb，历史数据或异常写入时可能混入非字符串值，这里先做收口。
  return value.filter((item): item is string => typeof item === "string");
}

export function getSearchableNoteText(note: Note) {
  const summary = note.ai_summary;

  // 搜索统一把标题、链接、标签、正文和 AI 摘要拼成一个小写文本，避免前后端各写一套匹配逻辑。
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
