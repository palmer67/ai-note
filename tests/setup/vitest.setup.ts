import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 每个测试用例结束后都清理挂载的 DOM，避免组件状态串到下一个用例。
afterEach(() => {
  cleanup();
});
