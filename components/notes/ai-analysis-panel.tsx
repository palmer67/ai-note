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

export function AiAnalysisPanel({ note, isAnalyzing, error, onAnalyze }: AiAnalysisPanelProps) {
  const summary = note?.ai_summary;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">AI 深度拆解</h2>
          <p className="panel-subtitle">
            模型调用放在后端完成，结果会自动回写到这条笔记里。
          </p>
        </div>
        <button type="button" className="button secondary" disabled={!note || isAnalyzing} onClick={onAnalyze}>
          {isAnalyzing ? "分析中..." : "开始分析"}
        </button>
      </div>

      {!note ? (
        <div className="empty-state">
          <div>
            <strong>请先保存一条笔记。</strong>
            <p>AI 分析只会针对已保存的笔记执行，这样结果才能绑定到对应记录上。</p>
          </div>
        </div>
      ) : summary ? (
        <div className="analysis-block">
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
        </div>
      ) : (
        <div className="empty-state">
          <div>
            <strong>还没有 AI 分析结果。</strong>
            <p>保存好文章后，点击上方按钮就能生成结构化阅读卡片。</p>
          </div>
        </div>
      )}

      {error ? <p className="feedback error">{error}</p> : null}
    </section>
  );
}
