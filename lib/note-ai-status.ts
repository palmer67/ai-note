import type { AiStatus } from "@/lib/types";

export function getNoteAiStatusLabel(status: AiStatus) {
  // 与生命周期标签类似，AI 状态文案也集中管理，避免工作台和资料集面板漂移。
  switch (status) {
    case "idle":
      return "未分析";
    case "loading":
      return "分析中";
    case "done":
      return "已完成";
    case "error":
      return "失败";
    default:
      return status;
  }
}
