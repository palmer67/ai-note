import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const searchParamsGetMock = vi.hoisted(() => vi.fn<(key: string) => string | null>());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  }),
  useSearchParams: () => ({
    get: searchParamsGetMock
  })
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: createClientMock
}));

import { AuthForm } from "@/components/forms/auth-form";

function createSupabaseAuthMock() {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn()
    }
  };
}

describe("AuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGetMock.mockReturnValue(null);
  });

  it("shows validation feedback when email or password is missing", async () => {
    createClientMock.mockReturnValue(createSupabaseAuthMock());

    render(<AuthForm mode="signin" />);

    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("邮箱和密码都需要填写。")).toBeInTheDocument();
  });

  it("translates supabase signin errors", async () => {
    const supabase = createSupabaseAuthMock();
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" }
    });
    createClientMock.mockReturnValue(supabase);

    render(<AuthForm mode="signin" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("邮箱或密码不正确。")).toBeInTheDocument();
  });

  it("navigates to dashboard after successful signin", async () => {
    const supabase = createSupabaseAuthMock();
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: null
    });
    createClientMock.mockReturnValue(supabase);

    render(<AuthForm mode="signin" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("shows signup success feedback when email confirmation is required", async () => {
    const supabase = createSupabaseAuthMock();
    supabase.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null
    });
    createClientMock.mockReturnValue(supabase);

    render(<AuthForm mode="signup" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "注册账号" }));

    expect(
      await screen.findByText("账号已创建。如果当前项目开启了邮箱验证，请先去邮箱完成验证后再登录。")
    ).toBeInTheDocument();
  });

  it("shows signed out banner for admin origin", () => {
    const supabase = createSupabaseAuthMock();
    createClientMock.mockReturnValue(supabase);
    searchParamsGetMock.mockImplementation((key) => {
      if (key === "signed_out") {
        return "1";
      }

      if (key === "from") {
        return "admin";
      }

      return null;
    });

    render(<AuthForm mode="signin" />);

    expect(screen.getByText("你已退出管理员工作台，请重新登录后再访问后台。")).toBeInTheDocument();
  });
});
