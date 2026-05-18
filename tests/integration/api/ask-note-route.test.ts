import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInvalidJsonRequest, createJsonRequest, readJson } from "@/tests/integration/api/helpers/http";
import { createSupabaseMock } from "@/tests/integration/api/helpers/supabase-mock";

const createClientMock = vi.hoisted(() => vi.fn());
const askNoteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock
}));

vi.mock("@/lib/openai/ask-note", () => ({
  askNote: askNoteMock
}));

import { POST } from "@/app/api/ai/ask-note/route";

describe("POST /api/ai/ask-note", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not logged in", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock());

    const response = await POST(createJsonRequest({ noteId: "note-1", question: "问题" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(payload.error).toBe("请先登录后再使用笔记问答功能。");
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

    const response = await POST(createJsonRequest({ question: "问题" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("缺少 note id。");
  });

  it("returns 400 when question is empty", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(createJsonRequest({ noteId: "note-1", question: "   " }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请先输入你的问题。");
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

    const response = await POST(createJsonRequest({ noteId: "note-1", question: "问题" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(payload.error).toBe("没有找到对应的笔记。");
  });

  it("returns the answer on success", async () => {
    const note = {
      id: "note-1",
      title: "测试笔记",
      source_url: "https://example.com",
      marker: "AI",
      content: "正文",
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
        noteSelectResult: { data: note, error: null }
      })
    );
    askNoteMock.mockResolvedValue("这是回答");

    const response = await POST(createJsonRequest({ noteId: "note-1", question: "这篇文章讲什么？" }));
    const payload = await readJson<{ answer: string }>(response);

    expect(response.status).toBe(200);
    expect(askNoteMock).toHaveBeenCalledWith({
      title: "测试笔记",
      sourceUrl: "https://example.com",
      marker: "AI",
      content: "正文",
      summary: note.ai_summary,
      question: "这篇文章讲什么？"
    });
    expect(payload.answer).toBe("这是回答");
  });

  it("returns 500 when the model layer fails", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        user: { id: "user-1" },
        noteSelectResult: {
          data: {
            id: "note-1",
            title: "测试笔记",
            source_url: null,
            marker: null,
            content: "正文",
            ai_summary: null
          },
          error: null
        }
      })
    );
    askNoteMock.mockRejectedValue(new Error("问答失败"));

    const response = await POST(createJsonRequest({ noteId: "note-1", question: "问题" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(payload.error).toBe("问答失败");
  });
});
