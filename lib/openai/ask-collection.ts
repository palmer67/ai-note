import { createModelClient, getModelName, runModelRequest } from "@/lib/openai/client";
import { parseTags } from "@/lib/tags";
import type { CollectionAnswer, Note } from "@/lib/types";

interface AskCollectionInput {
  notes: Note[];
  question: string;
}

const MAX_COLLECTION_NOTES = 5;
const MAX_CONTENT_SNIPPET_LENGTH = 800;

const systemPrompt = `
你是一个帮助用户基于多篇阅读笔记做综合回答的知识助手。

回答规则：
- 使用简体中文。
- 只能基于用户提供的资料集内容回答。
- 优先利用每篇笔记已有的 AI 摘要，再结合必要的正文片段。
- 如果资料不足，不要编造，直接明确指出信息不够。
- 回答尽量清晰、具体、可执行。
- 只返回合法 JSON。
- JSON 结构必须严格为：
{
  "answer": "string",
  "referencedTitles": ["string"]
}
- referencedTitles 只允许填你实际参考过的资料标题，最多 5 条。
`.trim();

function buildNoteContext(note: Note, index: number) {
  const tags = parseTags(note.marker).join("、") || "无";
  const summary = note.ai_summary
    ? [
        `主题：${note.ai_summary.topic}`,
        `核心观点：${note.ai_summary.coreArgument}`,
        `关键论据：${note.ai_summary.supportingEvidence.join("；") || "无"}`,
        `适用场景：${note.ai_summary.bestFitScenarios.join("；") || "无"}`,
        `启发：${note.ai_summary.takeaways.join("；") || "无"}`
      ].join("\n")
    : "AI 摘要：无";

  const contentSnippet = note.ai_summary ? "" : `正文片段：${note.content.slice(0, MAX_CONTENT_SNIPPET_LENGTH)}`;

  return [
    `资料 ${index + 1}`,
    `标题：${note.title}`,
    `标签：${tags}`,
    `知识状态：${note.lifecycle_status}`,
    summary,
    contentSnippet
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeCollectionAnswer(raw: string, availableTitles: string[]): CollectionAnswer {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("模型返回的 JSON 格式不符合预期。");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("模型返回结果无法解析为资料集回答。");
  }

  const payload = parsed as Record<string, unknown>;
  const answer = String(payload.answer ?? "").trim();

  if (!answer) {
    throw new Error("模型返回了空回答。");
  }

  const referencedTitles = Array.isArray(payload.referencedTitles)
    ? payload.referencedTitles
        .map((item) => String(item).trim())
        .filter((title) => availableTitles.includes(title))
        .slice(0, MAX_COLLECTION_NOTES)
    : [];

  return {
    answer,
    referencedTitles
  };
}

export async function askCollection({ notes, question }: AskCollectionInput) {
  const selectedNotes = notes.slice(0, MAX_COLLECTION_NOTES);

  if (!selectedNotes.length) {
    throw new Error("请先选择至少一篇资料。");
  }

  const client = createModelClient();
  const noteContext = selectedNotes.map((note, index) => buildNoteContext(note, index)).join("\n\n---\n\n");

  const response = await runModelRequest(() =>
    client.chat.completions.create({
      model: getModelName(),
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
          content: `请基于下面的资料集回答问题。\n\n${noteContext}\n\n用户问题：\n${question}`.trim()
        }
      ]
    })
  );

  const raw = response.choices[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error("模型返回了空回答。");
  }

  return normalizeCollectionAnswer(
    raw,
    selectedNotes.map((note) => note.title)
  );
}
