import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOverview } from "@/components/admin/admin-overview";
import type { Note, Profile } from "@/lib/types";

const profiles: Profile[] = [
  {
    id: "admin-1",
    email: "admin@example.com",
    role: "admin",
    display_name: null,
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z"
  },
  {
    id: "user-2",
    email: "user@example.com",
    role: "user",
    display_name: null,
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z"
  }
];

const notes: Note[] = [
  {
    id: "note-1",
    user_id: "admin-1",
    title: "管理员笔记",
    source_url: null,
    marker: "AI",
    content: "管理员正文",
    ai_summary: null,
    ai_status: "idle",
    lifecycle_status: "inbox",
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z"
  },
  {
    id: "note-2",
    user_id: "user-2",
    title: "普通用户笔记",
    source_url: null,
    marker: "产品",
    content: "普通用户正文",
    ai_summary: null,
    ai_status: "idle",
    lifecycle_status: "distilled",
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z"
  }
];

describe("AdminOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("does not allow editing the current admin role", () => {
    render(<AdminOverview currentAdminId="admin-1" profiles={profiles} notes={notes} />);

    expect(screen.getByText("当前账号不可改")).toBeInTheDocument();
  });

  it("resets tag filter and shows feedback when the tag is no longer in scope", async () => {
    render(<AdminOverview currentAdminId="admin-1" profiles={profiles} notes={notes} />);

    fireEvent.click(screen.getByRole("button", { name: "ai" }));
    fireEvent.change(screen.getByLabelText("按用户筛选"), { target: { value: "user-2" } });

    expect(await screen.findByText("当前标签筛选已重置，因为它不在新的结果范围内。")).toBeInTheDocument();
    expect(screen.getByText("普通用户笔记")).toBeInTheDocument();
  });

  it("updates role feedback after a successful role change", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            id: "user-2",
            email: "user@example.com",
            role: "admin",
            display_name: null,
            created_at: "2026-05-18T00:00:00.000Z",
            updated_at: "2026-05-18T00:00:00.000Z"
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    render(<AdminOverview currentAdminId="admin-1" profiles={profiles} notes={notes} />);

    fireEvent.click(screen.getByRole("button", { name: "设为管理员" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByText("已将 user@example.com 设置为管理员。")).toBeInTheDocument();
    });
  });
});
