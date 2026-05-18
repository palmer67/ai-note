import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthStage } from "@/components/forms/auth-stage";

describe("AuthStage", () => {
  it("renders signin copy and child content", () => {
    render(
      <AuthStage mode="signin">
        <div>登录表单占位</div>
      </AuthStage>
    );

    expect(screen.getByText("回到你的 AI 笔记工作台")).toBeInTheDocument();
    expect(screen.getByText("登录表单占位")).toBeInTheDocument();
  });

  it("renders signup copy", () => {
    render(
      <AuthStage mode="signup">
        <div>注册表单占位</div>
      </AuthStage>
    );

    expect(screen.getByText("创建你的 AI 阅读笔记空间")).toBeInTheDocument();
    expect(screen.getByText("支持链接导入、标签整理与 AI 分析")).toBeInTheDocument();
  });
});
