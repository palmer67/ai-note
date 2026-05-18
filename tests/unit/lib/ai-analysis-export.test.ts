import { describe, expect, it } from "vitest";

import {
  buildExportableAiAnalysisPayload,
  buildSingleAiAnalysisExportFile,
  canExportAiAnalysis,
  getExportFormatLabel
} from "@/lib/exports/ai-analysis";
import type { Note } from "@/lib/types";

const analyzedNote: Note = {
  id: "note-1",
  user_id: "user-1",
  title: "AI 产品设计笔记",
  source_url: "https://example.com/ai-note",
  marker: "AI, 产品",
  content: "这段正文不应该出现在导出结果里。",
  ai_summary: {
    topic: "产品设计",
    coreArgument: "先收敛问题边界，再设计交互路径。",
    supportingEvidence: ["先界定用户问题可以减少返工"],
    bestFitScenarios: ["产品方案评审"],
    takeaways: ["先界定边界"]
  },
  ai_status: "done",
  lifecycle_status: "distilled",
  created_at: "2026-05-18T00:00:00.000Z",
  updated_at: "2026-05-18T00:00:00.000Z"
};

describe("ai analysis exports", () => {
  it("detects whether a note can be exported", () => {
    expect(canExportAiAnalysis(analyzedNote)).toBe(true);
    expect(canExportAiAnalysis({ ...analyzedNote, ai_summary: null })).toBe(false);
  });

  it("builds a normalized export payload", () => {
    expect(buildExportableAiAnalysisPayload(analyzedNote)).toEqual({
      noteId: "note-1",
      title: "AI 产品设计笔记",
      sourceUrl: "https://example.com/ai-note",
      tags: ["ai", "产品"],
      analysis: analyzedNote.ai_summary
    });
  });

  it("renders markdown export content with frontmatter and sections", () => {
    const file = buildSingleAiAnalysisExportFile(analyzedNote, "markdown");

    expect(file.filename).toMatch(/-ai-analysis\.md$/);
    expect(file.content).toContain('title: "AI 产品设计笔记"');
    expect(file.content).toContain("## 核心观点");
    expect(file.content).toContain("先收敛问题边界，再设计交互路径。");
    expect(file.content).not.toContain("这段正文不应该出现在导出结果里。");
  });

  it("renders json export content as structured data", () => {
    const file = buildSingleAiAnalysisExportFile(analyzedNote, "json");
    const parsed = JSON.parse(file.content) as {
      title: string;
      sourceUrl: string | null;
      tags: string[];
      analysis: { topic: string };
    };

    expect(file.filename).toMatch(/-ai-analysis\.json$/);
    expect(parsed.title).toBe("AI 产品设计笔记");
    expect(parsed.tags).toEqual(["ai", "产品"]);
    expect(parsed.analysis.topic).toBe("产品设计");
  });

  it("renders html export content without raw note body", () => {
    const file = buildSingleAiAnalysisExportFile(analyzedNote, "html");

    expect(file.filename).toMatch(/-ai-analysis\.html$/);
    expect(file.content).toContain("<h2>主题</h2>");
    expect(file.content).toContain("https://example.com/ai-note");
    expect(file.content).not.toContain("这段正文不应该出现在导出结果里。");
  });

  it("exposes human readable labels for export formats", () => {
    expect(getExportFormatLabel("markdown")).toBe("Markdown");
    expect(getExportFormatLabel("json")).toBe("JSON");
    expect(getExportFormatLabel("html")).toBe("HTML");
  });
});
