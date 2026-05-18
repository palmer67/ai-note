import { describe, expect, it } from "vitest";

import { getNoteLifecycleLabel, noteLifecycleOptions, noteLifecycleViewOptions } from "@/lib/note-lifecycle";

describe("note lifecycle helpers", () => {
  it("exposes all lifecycle options", () => {
    expect(noteLifecycleOptions.map((option) => option.value)).toEqual(["inbox", "distilled", "archived"]);
  });

  it("exposes view options with the all view first", () => {
    expect(noteLifecycleViewOptions.map((option) => option.value)).toEqual([
      "all",
      "inbox",
      "distilled",
      "archived"
    ]);
  });

  it("returns the localized label for a lifecycle status", () => {
    expect(getNoteLifecycleLabel("distilled")).toBe("已提炼");
  });
});
