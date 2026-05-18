import { describe, expect, it } from "vitest";

import { normalizeTag, parseTags, serializeTags } from "@/lib/tags";

describe("tags helpers", () => {
  it("normalizes tag casing and whitespace", () => {
    expect(normalizeTag("  AI   Notes ")).toBe("ai notes");
  });

  it("parses multiple delimiters and removes duplicates", () => {
    expect(parseTags("AI，写作; 方法论、AI\n产品")).toEqual(["ai", "写作", "方法论", "产品"]);
  });

  it("serializes normalized unique tags", () => {
    expect(serializeTags([" AI ", "写作", "ai", "方法论"])).toBe("ai, 写作, 方法论");
  });
});
