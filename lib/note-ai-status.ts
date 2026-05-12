import type { AiStatus } from "@/lib/types";

export function getNoteAiStatusLabel(status: AiStatus) {
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
