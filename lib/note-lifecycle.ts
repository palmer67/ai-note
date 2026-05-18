import type { NoteLifecycleStatus } from "@/lib/types";

export interface NoteLifecycleOption {
  value: NoteLifecycleStatus;
  label: string;
}

export type NoteLifecycleView = "all" | NoteLifecycleStatus;

export const noteLifecycleOptions: NoteLifecycleOption[] = [
  {
    value: "inbox",
    label: "待整理"
  },
  {
    value: "distilled",
    label: "已提炼"
  },
  {
    value: "archived",
    label: "已归档"
  }
];

export const noteLifecycleViewOptions: Array<{ value: NoteLifecycleView; label: string }> = [
  {
    value: "all",
    label: "全部"
  },
  ...noteLifecycleOptions
];

export function getNoteLifecycleLabel(status: NoteLifecycleStatus) {
  // UI 层统一通过这个函数取中文文案，避免各组件手写状态映射。
  return noteLifecycleOptions.find((option) => option.value === status)?.label ?? status;
}
