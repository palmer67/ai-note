import { createModelClient, getModelName, runModelRequest } from "@/lib/openai/client";
import type { ArticleBreakdown } from "@/lib/types";

interface AskNoteInput {
  title: string;
  sourceUrl: string | null;
  marker: string | null;
  content: string;
  summary: ArticleBreakdown | null;
  question: string;
}

const systemPrompt = `
你是一个帮助用户消化单篇文章笔记的阅读助手。

回答规则：
- 使用简体中文。
- 只基于用户提供的这篇笔记内容和已有摘要回答。
- 如果问题超出笔记内容，不要编造，直接明确说明“这篇笔记里没有足够信息”。
- 回答尽量清晰、简洁、有条理。
- 如果适合，用短段落或短列表表达。
`.trim();

export async function askNote(input: AskNoteInput) {
  const client = createModelClient();

  const summaryBlock = input.summary
    ? `
已有 AI 摘要：
- 主题：${input.summary.topic}
- 核心观点：${input.summary.coreArgument}
- 关键论据：${input.summary.supportingEvidence.join("；")}
- 适用场景：${input.summary.bestFitScenarios.join("；")}
- 我的启发：${input.summary.takeaways.join("；")}
      `.trim()
    : "已有 AI 摘要：无";

  const response = await runModelRequest(() =>
    client.chat.completions.create({
      model: getModelName(),
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
用户标签：${input.marker ?? "无"}

文章正文：
${input.content}

${summaryBlock}

用户问题：
${input.question}
          `.trim()
        }
      ]
    })
  );

  const answer = response.choices[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("模型返回了空回答。");
  }

  return answer;
}
