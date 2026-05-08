export type AppRole = "admin" | "user";

export type AiStatus = "idle" | "loading" | "done" | "error";

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
  created_at: string;
  updated_at: string;
}

export interface NoteDraft {
  title: string;
  source_url: string;
  marker: string;
  content: string;
}
