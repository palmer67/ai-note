import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInvalidJsonRequest, createJsonRequest, readJson } from "@/tests/integration/api/helpers/http";
import { createSupabaseMock } from "@/tests/integration/api/helpers/supabase-mock";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock
}));

import { POST } from "@/app/api/admin/profiles/role/route";

describe("POST /api/admin/profiles/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not logged in", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock());

    const response = await POST(createJsonRequest({ targetProfileId: "user-2", role: "admin" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(payload.error).toBe("请先登录。");
  });

  it("returns 400 when request json is invalid", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "admin-1" } }));

    const response = await POST(createInvalidJsonRequest());
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请求体格式不正确。");
  });

  it("returns 400 when target user or role is invalid", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock({ user: { id: "admin-1" } }));

    const response = await POST(createJsonRequest({ targetProfileId: "user-2", role: "owner" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("缺少目标用户或角色参数。");
  });

  it("returns updated profile on success", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        user: { id: "admin-1" },
        rpcResult: {
          data: {
            id: "user-2",
            email: "user@example.com",
            role: "admin"
          },
          error: null
        }
      })
    );

    const response = await POST(createJsonRequest({ targetProfileId: "user-2", role: "admin" }));
    const payload = await readJson<{ profile: { role: string; email: string } }>(response);

    expect(response.status).toBe(200);
    expect(payload.profile.role).toBe("admin");
    expect(payload.profile.email).toBe("user@example.com");
  });

  it("returns 400 when rpc rejects the change", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        user: { id: "admin-1" },
        rpcResult: {
          data: null,
          error: { message: "系统里至少要保留一个管理员。" }
        }
      })
    );

    const response = await POST(createJsonRequest({ targetProfileId: "user-2", role: "user" }));
    const payload = await readJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("系统里至少要保留一个管理员。");
  });
});
