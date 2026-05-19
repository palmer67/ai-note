import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createClient: createClientMock
}));

import { NotesWorkspace } from "@/components/notes/notes-workspace";
import type { Note, Profile, SavedNoteCollection } from "@/lib/types";

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

const initialCollections: SavedNoteCollection[] = [
  {
    id: "collection-1",
    user_id: "user-1",
    name: "写作资料集",
    description: "围绕 AI 写作方法的资料。",
    note_ids: ["note-1"],
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z"
  }
];

function createSupabaseClientMock(options: {
  collectionInsertResult?: {
    data: Omit<SavedNoteCollection, "note_ids"> | null;
    error: { message: string } | null;
  };
} = {}) {
  const notesTable = {
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
  };
  const collectionInsertResult = options.collectionInsertResult ?? {
    data: null,
    error: null
  };
  const noteCollectionsTable = {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(collectionInsertResult)
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    }))
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "note_collections") {
        return noteCollectionsTable;
      }

      return notesTable;
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    __mocks: {
      notesTable,
      noteCollectionsTable
    }
  };
}

describe("NotesWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockReturnValue(createSupabaseClientMock());
    vi.stubGlobal("fetch", vi.fn());
  });

  it("filters notes by search text", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    fireEvent.change(screen.getByPlaceholderText("搜索标题、标签、来源、正文或 AI 分析"), {
      target: { value: "归档" }
    });

    expect(screen.getByText("1 篇结果")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "加入资料集" })).toHaveLength(1);
  });

  it("does not auto-select a note on first load", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    expect(screen.getByText("未选择")).toBeInTheDocument();
    expect(screen.getByText("选择一篇文章开始工作")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建笔记" })).toBeInTheDocument();
    expect(screen.getByText("请先保存一条笔记。")).toBeInTheDocument();
  });

  it("filters notes by lifecycle view", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    fireEvent.click(screen.getAllByRole("button", { name: /已归档/ })[0]);

    expect(screen.getByText("1 篇结果")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "加入资料集" })).toHaveLength(1);
  });

  it("adds, removes, and clears notes from the temporary collection", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    const collectionSection = screen.getByRole("heading", { name: "资料集" }).closest("section");

    if (!collectionSection) {
      throw new Error("Missing collection section");
    }

    fireEvent.click(screen.getAllByRole("button", { name: "加入资料集" })[0]);

    expect(within(collectionSection).getByText("已选 1 篇")).toBeInTheDocument();
    expect(within(collectionSection).getByText("AI 写作方法")).toBeInTheDocument();

    fireEvent.click(within(collectionSection).getByRole("button", { name: "移除" }));

    expect(within(collectionSection).getByText("还没有加入资料。")).toBeInTheDocument();
    expect(collectionSection).toHaveClass("is-empty");

    fireEvent.click(screen.getAllByRole("button", { name: "加入资料集" })[0]);
    fireEvent.click(within(collectionSection).getByRole("button", { name: "清空当前" }));

    expect(within(collectionSection).getByText("还没有加入资料。")).toBeInTheDocument();
    expect(collectionSection).toHaveClass("is-empty");
  });

  it("loads a saved collection into the current collection", () => {
    render(
      <NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} initialCollections={initialCollections} />
    );

    fireEvent.click(screen.getByRole("button", { name: /写作资料集/ }));

    const collectionSection = screen.getByRole("heading", { name: "资料集" }).closest("section");

    if (!collectionSection) {
      throw new Error("Missing collection section");
    }

    expect(within(collectionSection).getByText("已选 1 篇")).toBeInTheDocument();
    expect(within(collectionSection).getByText("AI 写作方法")).toBeInTheDocument();
    expect(within(collectionSection).getByText("正在编辑：写作资料集")).toBeInTheDocument();
  });

  it("saves the current selection as a persistent collection", async () => {
    const collectionRow = {
      id: "collection-2",
      user_id: "user-1",
      name: "新资料集",
      description: "后续复盘用。",
      created_at: "2026-05-19T00:00:00.000Z",
      updated_at: "2026-05-19T00:00:00.000Z"
    };
    const supabaseMock = createSupabaseClientMock({
      collectionInsertResult: {
        data: collectionRow,
        error: null
      }
    });

    createClientMock.mockReturnValue(supabaseMock);
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    fireEvent.click(screen.getAllByRole("button", { name: "加入资料集" })[0]);
    fireEvent.change(screen.getByLabelText("资料集名称"), {
      target: { value: "新资料集" }
    });
    fireEvent.change(screen.getByLabelText("说明"), {
      target: { value: "后续复盘用。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存为资料集" }));

    expect(await screen.findByText("资料集已保存。")).toBeInTheDocument();
    expect(supabaseMock.rpc).toHaveBeenCalledWith("replace_note_collection_items", {
      target_collection_id: "collection-2",
      target_note_ids: ["note-1"]
    });
    expect(screen.getByText("新资料集")).toBeInTheDocument();
  });

  it("switches into batch export mode and hides collection buttons", () => {
    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    fireEvent.click(screen.getByRole("button", { name: "批量导出" }));

    expect(screen.getByRole("button", { name: "退出批量模式" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "加入资料集" })).not.toBeInTheDocument();
  });

  it("submits collection qa and shows the answer", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: "这些文章都强调先做结构化整理。",
          referencedTitles: ["AI 写作方法"]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);
    const collectionSection = screen.getByRole("heading", { name: "资料集" }).closest("section");

    if (!collectionSection) {
      throw new Error("Missing collection section");
    }

    fireEvent.click(screen.getAllByRole("button", { name: "加入资料集" })[0]);
    fireEvent.change(screen.getByPlaceholderText("例如：这些文章共同强调了哪些方法？它们在哪些观点上互相补充？"), {
      target: { value: "这些文章的共同点是什么？" }
    });
    fireEvent.click(screen.getByRole("button", { name: "开始资料集问答" }));

    expect(await screen.findByText("这些文章都强调先做结构化整理。")).toBeInTheDocument();
    expect(screen.getByText("参考资料：")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    expect(collectionSection).toHaveClass("has-answer");
  });

  it("clears collection qa state when the collection is cleared", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: "这些文章都强调先做结构化整理。",
          referencedTitles: ["AI 写作方法"]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    render(<NotesWorkspace currentProfile={currentProfile} initialNotes={initialNotes} />);

    fireEvent.click(screen.getAllByRole("button", { name: "加入资料集" })[0]);
    fireEvent.change(screen.getByPlaceholderText("例如：这些文章共同强调了哪些方法？它们在哪些观点上互相补充？"), {
      target: { value: "这些文章的共同点是什么？" }
    });
    fireEvent.click(screen.getByRole("button", { name: "开始资料集问答" }));

    expect(await screen.findByText("这些文章都强调先做结构化整理。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空当前" }));

    expect(screen.queryByText("这些文章都强调先做结构化整理。")).not.toBeInTheDocument();
  });
});
