import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInvalidJsonRequest, createJsonRequest, readJson } from "@/tests/integration/api/helpers/http";
import { createSupabaseMock } from "@/tests/integration/api/helpers/supabase-mock";

const createClientMock = vi.hoisted(() => vi.fn());
const analyzeNoteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock
}));

vi.mock("@/lib/openai/analyze-note", () => ({
  analyzeNote: analyzeNoteMock
}));

import { POST } from "@/app/api/ai/analyze/route";

describe("POST /api/ai/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not logged in", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock());

    const response = await POST(createJsonRequest({ noteId: "note-1" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(payload.error).toBe("请先登录后再使用 AI 分析功能。");
  });

  it("returns 400 when request json is invalid", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(createInvalidJsonRequest());
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请求体格式不正确。");
  });

  it("returns 400 when note id is missing", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(createJsonRequest({}));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("缺少 note id。");
  });

  it("returns 404 when the note does not exist", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        user: { id: "user-1" },
        noteSelectResult: {
          data: null,
          error: { message: "not found" }
        }
      })
    );

    const response = await POST(createJsonRequest({ noteId: "note-1" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(payload.error).toBe("没有找到对应的笔记。");
  });

  it("returns the updated note on success", async () => {
    const note = {
      id: "note-1",
      title: "测试笔记",
      source_url: "https://example.com",
      marker: "AI",
      content: "正文"
    };
    const updatedNote = {
      ...note,
      ai_status: "done",
      ai_summary: {
        topic: "主题",
        coreArgument: "观点",
        supportingEvidence: ["论据"],
        bestFitScenarios: ["场景"],
        takeaways: ["启发"]
      }
    };

    createClientMock.mockResolvedValue(
      createSupabaseMock({
        user: { id: "user-1" },
        noteSelectResult: { data: note, error: null },
        noteUpdateResult: { data: updatedNote, error: null }
      })
    );
    analyzeNoteMock.mockResolvedValue(updatedNote.ai_summary);

    const response = await POST(createJsonRequest({ noteId: "note-1" }));
    const payload = await readJson<{ note: typeof updatedNote }>(response);

    expect(response.status).toBe(200);
    expect(analyzeNoteMock).toHaveBeenCalledWith({
      title: "测试笔记",
      sourceUrl: "https://example.com",
      marker: "AI",
      content: "正文"
    });
    expect(payload.note.ai_status).toBe("done");
    expect(payload.note.ai_summary.topic).toBe("主题");
  });

  it("returns 500 and marks note as error when analysis fails", async () => {
    const supabase = createSupabaseMock({
      user: { id: "user-1" },
      noteSelectResult: {
        data: {
          id: "note-1",
          title: "测试笔记",
          source_url: null,
          marker: null,
          content: "正文"
        },
        error: null
      }
    });

    createClientMock.mockResolvedValue(supabase);
    analyzeNoteMock.mockRejectedValue(new Error("模型失败"));

    const response = await POST(createJsonRequest({ noteId: "note-1" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(payload.error).toBe("模型失败");
    expect(supabase.__mocks.noteErrorUpdateEq).toHaveBeenCalledWith("id", "note-1");
  });
});
