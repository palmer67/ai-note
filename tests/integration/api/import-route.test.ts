import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInvalidJsonRequest, createJsonRequest, readJson } from "@/tests/integration/api/helpers/http";
import { createSupabaseMock } from "@/tests/integration/api/helpers/supabase-mock";

const createClientMock = vi.hoisted(() => vi.fn());
const importArticleFromUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock
}));

vi.mock("@/lib/articles/import-from-url", () => ({
  importArticleFromUrl: importArticleFromUrlMock
}));

import { POST } from "@/app/api/articles/import/route";

describe("POST /api/articles/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not logged in", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock());

    const response = await POST(createJsonRequest({ sourceUrl: "https://example.com" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(payload.error).toBe("请先登录后再导入链接。");
  });

  it("returns 400 when request json is invalid", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(createInvalidJsonRequest());
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请求体格式不正确。");
  });

  it("returns 400 when source url is missing", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));

    const response = await POST(createJsonRequest({}));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请先填写来源链接。");
  });

  it("returns imported article and article message on success", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));
    importArticleFromUrlMock.mockResolvedValue({
      title: "文章标题",
      sourceUrl: "https://example.com",
      content: "文章正文",
      extractionMode: "article"
    });

    const response = await POST(createJsonRequest({ sourceUrl: "https://example.com" }));
    const payload = await readJson<{
      article: { title: string; extractionMode: string };
      message: string;
    }>(response);

    expect(response.status).toBe(200);
    expect(importArticleFromUrlMock).toHaveBeenCalledWith("https://example.com");
    expect(payload.article.title).toBe("文章标题");
    expect(payload.message).toContain("已自动导入标题和正文");
  });

  it("returns fallback message when extraction mode is fallback", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));
    importArticleFromUrlMock.mockResolvedValue({
      title: "文章标题",
      sourceUrl: "https://example.com",
      content: "文章正文",
      extractionMode: "fallback"
    });

    const response = await POST(createJsonRequest({ sourceUrl: "https://example.com" }));
    const payload = await readJson<{ message: string }>(response);

    expect(response.status).toBe(200);
    expect(payload.message).toContain("已导入基础内容");
  });

  it("returns 400 when import service fails", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "user-1" } }));
    importArticleFromUrlMock.mockRejectedValue(new Error("导入失败"));

    const response = await POST(createJsonRequest({ sourceUrl: "https://example.com" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("导入失败");
  });
});
