import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInvalidJsonRequest, createJsonRequest, readJson } from "@/tests/integration/api/helpers/http";
import { createSupabaseMock } from "@/tests/integration/api/helpers/supabase-mock";

const createClientMock = vi.hoisted(() => vi.fn());
const askCollectionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock
}));

vi.mock("@/lib/openai/ask-collection", () => ({
  askCollection: askCollectionMock
}));

import { POST } from "@/app/api/ai/ask-collection/route";

describe("POST /api/ai/ask-collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not logged in", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock());

    const response = await POST(createJsonRequest({ noteIds: ["note-1"], question: "问题" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(payload.error).toBe("请先登录后再使用资料集问答功能。");
  });

  it("returns 400 when request json is invalid", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(createInvalidJsonRequest());
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请求体格式不正确。");
  });

  it("returns 400 when note ids are missing", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(createJsonRequest({ question: "问题" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请先选择至少一篇资料。");
  });

  it("returns 400 when note count exceeds the limit", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(
      createJsonRequest({
        noteIds: ["1", "2", "3", "4", "5", "6"],
        question: "问题"
      })
    );
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("当前最多只能基于 5 篇资料提问。");
  });

  it("returns 400 when question is empty", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(createJsonRequest({ noteIds: ["note-1"], question: "   " }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请先输入你的问题。");
  });

  it("returns 404 when no notes are found", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        user: { id: "user-1" },
        noteListResult: {
          data: [],
          error: null
        }
      })
    );

    const response = await POST(createJsonRequest({ noteIds: ["note-1"], question: "问题" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(payload.error).toBe("没有找到可用的资料。");
  });

  it("returns answer and referenced titles on success", async () => {
    const notes = [
      {
        id: "note-1",
        user_id: "user-1",
        title: "文章一",
        source_url: null,
        marker: "AI",
        content: "正文一",
        ai_summary: null,
        ai_status: "idle",
        lifecycle_status: "inbox",
        created_at: "2026-05-18T00:00:00.000Z",
        updated_at: "2026-05-18T00:00:00.000Z"
      }
    ];

    createClientMock.mockResolvedValue(
      createSupabaseMock({
        user: { id: "user-1" },
        noteListResult: {
          data: notes,
          error: null
        }
      })
    );
    askCollectionMock.mockResolvedValue({
      answer: "综合回答",
      referencedTitles: ["文章一"]
    });

    const response = await POST(createJsonRequest({ noteIds: ["note-1"], question: "这些文章有什么共同点？" }));
    const payload = await readJson<{ answer: string; referencedTitles: string[] }>(response);

    expect(response.status).toBe(200);
    expect(askCollectionMock).toHaveBeenCalledWith({
      notes,
      question: "这些文章有什么共同点？"
    });
    expect(payload.answer).toBe("综合回答");
    expect(payload.referencedTitles).toEqual(["文章一"]);
  });

  it("returns 500 when collection ai service fails", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        user: { id: "user-1" },
        noteListResult: {
          data: [
            {
              id: "note-1",
              user_id: "user-1",
              title: "文章一",
              source_url: null,
              marker: null,
              content: "正文一",
              ai_summary: null,
              ai_status: "idle",
              lifecycle_status: "inbox",
              created_at: "2026-05-18T00:00:00.000Z",
              updated_at: "2026-05-18T00:00:00.000Z"
            }
          ],
          error: null
        }
      })
    );
    askCollectionMock.mockRejectedValue(new Error("资料集问答失败"));

    const response = await POST(createJsonRequest({ noteIds: ["note-1"], question: "问题" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(500);
    expect(payload.error).toBe("资料集问答失败");
  });
});
