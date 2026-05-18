import { describe, expect, it } from "vitest";

import { getSearchableNoteText } from "@/lib/notes/search";
import type { Note } from "@/lib/types";

const baseNote: Note = {
  id: "note-1",
  user_id: "user-1",
  title: "AI 写作方法论",
  source_url: "https://example.com/article",
  marker: "AI, 写作",
  content: "这是一篇关于写作流程的正文内容。",
  ai_summary: {
    topic: "写作流程",
    coreArgument: "先搭框架再补细节",
    supportingEvidence: ["先列提纲效率更高"],
    bestFitScenarios: ["长文写作"],
    takeaways: ["结构优先"]
  },
  ai_status: "done",
  lifecycle_status: "inbox",
  created_at: "2026-05-18T00:00:00.000Z",
  updated_at: "2026-05-18T00:00:00.000Z"
};

describe("note search helper", () => {
  it("includes title, url, tags, content, and ai summary text", () => {
    const searchableText = getSearchableNoteText(baseNote);

    expect(searchableText).toContain("ai 写作方法论");
    expect(searchableText).toContain("https://example.com/article");
    expect(searchableText).toContain("写作流程");
    expect(searchableText).toContain("结构优先");
  });

  it("ignores non-string values inside summary arrays", () => {
    const noteWithDirtySummary: Note = {
      ...baseNote,
      ai_summary: {
        topic: baseNote.ai_summary?.topic ?? "",
        coreArgument: baseNote.ai_summary?.coreArgument ?? "",
        supportingEvidence: ["有效文本", 123, null] as unknown as string[],
        bestFitScenarios: baseNote.ai_summary?.bestFitScenarios ?? [],
        takeaways: baseNote.ai_summary?.takeaways ?? []
      }
    };

    const searchableText = getSearchableNoteText(noteWithDirtySummary);

    expect(searchableText).toContain("有效文本");
    expect(searchableText).not.toContain("123");
    expect(searchableText).not.toContain("null");
  });
});
