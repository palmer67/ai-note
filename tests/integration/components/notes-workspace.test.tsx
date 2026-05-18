import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createClient: createClientMock
}));

import { NotesWorkspace } from "@/components/notes/notes-workspace";
import type { Note, Profile } from "@/lib/types";

const currentProfile: Profile = {
  id: "user-1",
  email: "user@example.com",
  role: "user",
  display_name: null,
  created_at: "2026-05-18T00:00:00.000Z",
  updated_at: "2026-05-18T00:00:00.000Z"
};

const initialNotes: Note[] = [
  {
    id: "note-1",
    user_id: "user-1",
    title: "AI 写作方法",
    source_url: "https://example.com/ai-writing",
    marker: "AI, 写作",
    content: "这是一篇关于 AI 写作的正文。",
    ai_summary: {
      topic: "AI 写作",
      coreArgument: "先搭框架，再补细节。",
      supportingEvidence: ["提纲先行可以减少返工"],
      bestFitScenarios: ["长文写作"],
      takeaways: ["结构优先"]
    },
    ai_status: "done",
    lifecycle_status: "inbox",
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z"
  },
  {
    id: "note-2",
    user_id: "user-1",
    title: "归档笔记",
    source_url: "https://example.com/archive",
    marker: "产品",
    content: "这是一篇已经归档的笔记。",
    ai_summary: null,
    ai_status: "idle",
    lifecycle_status: "archived",
    created_at: "2026-05-17T00:00:00.000Z",
    updated_at: "2026-05-17T00:00:00.000Z"
  }
];

function createSupabaseClientMock() {
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  };
}

describe("NotesWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockReturnValue(createSupabaseClientMock());
  });

  it("filters notes by search text", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    fireEvent.change(screen.getByPlaceholderText("搜索标题、标签、来源、正文或 AI 分析"), {
      target: { value: "归档" }
    });

    expect(screen.getByText("1 篇结果")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "加入资料集" })).toHaveLength(1);
  });

  it("filters notes by lifecycle view", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    fireEvent.click(screen.getAllByRole("button", { name: /已归档/ })[0]);

    expect(screen.getByText("1 篇结果")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "加入资料集" })).toHaveLength(1);
  });

  it("adds, removes, and clears notes from the temporary collection", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    const collectionSection = screen.getByRole("heading", { name: "临时资料集" }).closest("section");

    if (!collectionSection) {
      throw new Error("Missing collection section");
    }

    fireEvent.click(screen.getAllByRole("button", { name: "加入资料集" })[0]);

    expect(within(collectionSection).getByText("已选 1 篇")).toBeInTheDocument();
    expect(within(collectionSection).getByText("AI 写作方法")).toBeInTheDocument();

    fireEvent.click(within(collectionSection).getByRole("button", { name: "移除" }));

    expect(within(collectionSection).getByText("还没有加入资料。")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "加入资料集" })[0]);
    fireEvent.click(within(collectionSection).getByRole("button", { name: "清空" }));

    expect(within(collectionSection).getByText("还没有加入资料。")).toBeInTheDocument();
  });

  it("switches into batch export mode and hides collection buttons", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    fireEvent.click(screen.getByRole("button", { name: "批量导出" }));

    expect(screen.getByRole("button", { name: "退出批量模式" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "加入资料集" })).not.toBeInTheDocument();
  });
});
