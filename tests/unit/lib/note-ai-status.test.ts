import { describe, expect, it } from "vitest";

import { getNoteAiStatusLabel } from "@/lib/note-ai-status";

describe("note ai status helpers", () => {
  it("returns localized labels", () => {
    expect(getNoteAiStatusLabel("idle")).toBe("未分析");
    expect(getNoteAiStatusLabel("loading")).toBe("分析中");
    expect(getNoteAiStatusLabel("done")).toBe("已完成");
    expect(getNoteAiStatusLabel("error")).toBe("失败");
  });
});
