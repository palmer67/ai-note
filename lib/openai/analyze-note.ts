import OpenAI from "openai";

import type { ArticleBreakdown } from "@/lib/types";

interface AnalyzeNoteInput {
  title: string;
  sourceUrl: string | null;
  marker: string | null;
  content: string;
}

const systemPrompt = `
你会把保存下来的文章笔记拆解成清晰、结构化的学习摘要。

只返回合法 JSON。
结构必须严格遵守：
{
  "topic": "string",
  "coreArgument": "string",
  "supportingEvidence": ["string"],
  "bestFitScenarios": ["string"],
  "takeaways": ["string"]
}

规则：
- 所有字段内容都使用简体中文。
- 语气务实、具体，不要空泛。
- 除非文章过短无法分析，否则不要提“信息缺失”。
- 每个列表保留 3 到 5 条。
- 优先基于文章正文分析，用户标记只作为弱提示。
`.trim();

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeBreakdown(value: unknown): ArticleBreakdown {
  if (!value || typeof value !== "object") {
    throw new Error("模型返回结果无法解析为结构化拆解。");
  }

  const payload = value as Record<string, unknown>;

  return {
    topic: String(payload.topic ?? "").trim(),
    coreArgument: String(payload.coreArgument ?? "").trim(),
    supportingEvidence: normalizeArray(payload.supportingEvidence),
    bestFitScenarios: normalizeArray(payload.bestFitScenarios),
    takeaways: normalizeArray(payload.takeaways)
  };
}

export async function analyzeNote(input: AnalyzeNoteInput) {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY。");
  }

  const client = new OpenAI({
    apiKey,
    baseURL
  });

  const response = await client.chat.completions.create({
    model,
    response_format: {
      type: "json_object"
    },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `
文章标题：${input.title}
文章来源链接：${input.sourceUrl ?? "未提供"}
用户标记：${input.marker ?? "无"}

文章正文：
${input.content}
        `.trim()
      }
    ]
  });

  const raw = response.choices[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error("模型返回了空内容。");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("模型返回的 JSON 格式不符合预期。");
  }

  return normalizeBreakdown(parsed);
}
