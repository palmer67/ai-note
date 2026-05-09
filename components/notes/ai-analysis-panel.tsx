"use client";

import { useState, useTransition } from "react";

import type { Note } from "@/lib/types";

interface AiAnalysisPanelProps {
  note: Note | null;
  isAnalyzing: boolean;
  error: string | null;
  onAnalyze: () => void;
}

function getAiStatusLabel(status: Note["ai_status"]) {
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

function buildCopyText(note: NonNullable<AiAnalysisPanelProps["note"]>) {
  const summary = note.ai_summary;

  if (!summary) {
    return "";
  }

  return [
    `主题：${summary.topic}`,
    "",
    `核心观点：${summary.coreArgument}`,
    "",
    "关键论据：",
    ...summary.supportingEvidence.map((item) => `- ${item}`),
    "",
    "适用场景：",
    ...summary.bestFitScenarios.map((item) => `- ${item}`),
    "",
    "我的启发：",
    ...summary.takeaways.map((item) => `- ${item}`)
  ].join("\n");
}

export function AiAnalysisPanel({ note, isAnalyzing, error, onAnalyze }: AiAnalysisPanelProps) {
  const summary = note?.ai_summary;
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [copyPending, startCopy] = useTransition();
  const [askPending, startAsk] = useTransition();

  function handleCopy() {
    if (!note?.ai_summary) {
      return;
    }

    setCopyFeedback(null);

    startCopy(async () => {
      try {
        await navigator.clipboard.writeText(buildCopyText(note));
        setCopyFeedback("分析结果已复制。");
        window.setTimeout(() => setCopyFeedback(null), 1800);
      } catch {
        setCopyFeedback("复制失败，请手动复制。");
      }
    });
  }

  function handleAsk() {
    if (!note) {
      setAskError("请先保存一条笔记。");
      return;
    }

    setAskError(null);
    setAnswer(null);

    startAsk(async () => {
      const response = await fetch("/api/ai/ask-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          noteId: note.id,
          question
        })
      });

      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
      };

      if (!response.ok || !payload.answer) {
        setAskError(payload.error ?? "笔记问答失败。");
        return;
      }

      setAnswer(payload.answer);
    });
  }

  return (
    <section className="panel ai-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">AI 阅读助手</h2>
          <p className="panel-subtitle">先做文章拆解，再围绕这篇笔记继续追问更细的问题。</p>
        </div>
        <div className="table-actions">
          {summary ? (
            <button type="button" className="ghost-button" disabled={copyPending} onClick={handleCopy}>
              {copyPending ? "复制中..." : "复制分析"}
            </button>
          ) : null}
          <button type="button" className="button secondary" disabled={!note || isAnalyzing} onClick={onAnalyze}>
            {isAnalyzing ? "分析中..." : "开始分析"}
          </button>
        </div>
      </div>

      <div className="ai-panel-body">
        {!note ? (
          <div className="empty-state compact-empty-state">
            <div>
              <strong>请先保存一条笔记。</strong>
              <p>AI 功能只会针对已保存的笔记执行，这样结果才能绑定到对应记录上。</p>
            </div>
          </div>
        ) : (
          <div className="analysis-block">
            {summary ? (
              <>
                <span className="status-badge">状态：{getAiStatusLabel(note.ai_status)}</span>

                <section className="analysis-section">
                  <h3>主题</h3>
                  <p>{summary.topic}</p>
                </section>

                <section className="analysis-section">
                  <h3>核心观点</h3>
                  <p>{summary.coreArgument}</p>
                </section>

                <section className="analysis-section">
                  <h3>关键论据</h3>
                  <ul className="analysis-list">
                    {summary.supportingEvidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="analysis-section">
                  <h3>适用场景</h3>
                  <ul className="analysis-list">
                    {summary.bestFitScenarios.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="analysis-section">
                  <h3>我的启发</h3>
                  <ul className="analysis-list">
                    {summary.takeaways.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </>
            ) : (
              <div className="empty-state compact-empty-state">
                <div>
                  <strong>还没有 AI 分析结果。</strong>
                  <p>保存好文章后，点击上方按钮就能生成结构化阅读卡片。</p>
                </div>
              </div>
            )}

            <section className="analysis-section">
              <h3>问这篇笔记</h3>
              <div className="field ai-question-field">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="例如：这篇文章最适合什么场景？作者真正想表达的重点是什么？"
                />
              </div>
              <div className="editor-actions">
                <button type="button" className="button secondary" disabled={!question.trim() || askPending} onClick={handleAsk}>
                  {askPending ? "回答中..." : "开始问答"}
                </button>
              </div>
              {askError ? <p className="feedback error">{askError}</p> : null}
              {answer ? (
                <div className="analysis-answer-card">
                  <h4>回答</h4>
                  <p className="analysis-answer">{answer}</p>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>

      {copyFeedback ? <p className={`feedback${copyFeedback.includes("失败") ? " error" : ""}`}>{copyFeedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </section>
  );
}
