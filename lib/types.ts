export type AppRole = "admin" | "user";

export type AiStatus = "idle" | "loading" | "done" | "error";
export type NoteLifecycleStatus = "inbox" | "distilled" | "archived";

// 这是模型落库后的结构化摘要，也是导出、问答和搜索复用的统一数据形态。
export interface ArticleBreakdown {
  topic: string;
  coreArgument: string;
  supportingEvidence: string[];
  bestFitScenarios: string[];
  takeaways: string[];
}

export interface Profile {
  id: string;
  email: string;
  role: AppRole;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  source_url: string | null;
  marker: string | null;
  content: string;
  ai_summary: ArticleBreakdown | null;
  ai_status: AiStatus;
  lifecycle_status: NoteLifecycleStatus;
  created_at: string;
  updated_at: string;
}

// NoteDraft 只描述编辑器里的临时输入，不等同于数据库里的完整 Note 记录。
export interface NoteDraft {
  title: string;
  source_url: string;
  tags: string[];
  content: string;
}
