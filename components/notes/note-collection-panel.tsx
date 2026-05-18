import { getNoteAiStatusLabel } from "@/lib/note-ai-status";
import { getNoteLifecycleLabel } from "@/lib/note-lifecycle";
import { parseTags } from "@/lib/tags";
import type { CollectionAnswer, Note } from "@/lib/types";

interface NoteCollectionPanelProps {
  notes: Note[];
  onSelect: (note: Note) => void;
  onRemove: (noteId: string) => void;
  onClear: () => void;
  question: string;
  answer: CollectionAnswer | null;
  error: string | null;
  isAsking: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
}

export function NoteCollectionPanel({
  notes,
  onSelect,
  onRemove,
  onClear,
  question,
  answer,
  error,
  isAsking,
  onQuestionChange,
  onAsk
}: NoteCollectionPanelProps) {
  // 资料集本身不要求所有笔记都完成分析，所以这里把已分析和待分析数量分开展示。
  const analyzedCount = notes.filter((note) => note.ai_summary).length;
  const pendingCount = notes.length - analyzedCount;
  const collectionStateClass = notes.length ? (answer ? "has-answer" : "has-notes") : "is-empty";

  return (
    <section className={`panel collection-panel ${collectionStateClass}`}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">临时资料集</h2>
          <p className="panel-subtitle">从搜索结果里挑出几篇文章，先形成一组可复用的阅读材料。</p>
        </div>
        <button type="button" className="mini-button" disabled={!notes.length} onClick={onClear}>
          清空
        </button>
      </div>

      <div className="collection-stats">
        <span className="inline-badge">已选 {notes.length} 篇</span>
        <span className="inline-badge">已分析 {analyzedCount} 篇</span>
        <span className="inline-badge">待分析 {pendingCount} 篇</span>
      </div>

      <div className="collection-list">
        {notes.length ? (
          <>
            {notes.map((note) => {
              const tags = parseTags(note.marker);

              return (
                <article key={note.id} className="collection-item">
                  <button type="button" className="collection-item-main" onClick={() => onSelect(note)}>
                    <span className="collection-item-title">{note.title}</span>
                    <span className="collection-item-meta">
                      <span className={`status-badge lifecycle-badge lifecycle-${note.lifecycle_status}`}>
                        {getNoteLifecycleLabel(note.lifecycle_status)}
                      </span>
                      <span className={`status-badge ai-status-${note.ai_status}`}>
                        {getNoteAiStatusLabel(note.ai_status)}
                      </span>
                    </span>
                    <span className="tag-chip-row compact collection-tags">
                      {tags.length ? (
                        tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="muted">无标签</span>
                      )}
                    </span>
                  </button>
                  <button type="button" className="mini-button collection-remove" onClick={() => onRemove(note.id)}>
                    移除
                  </button>
                </article>
              );
            })}

            <section className="collection-qa-block">
              <h3>问资料集</h3>
              <div className="field ai-question-field">
                <textarea
                  value={question}
                  onChange={(event) => onQuestionChange(event.target.value)}
                  placeholder="例如：这些文章共同强调了哪些方法？它们在哪些观点上互相补充？"
                />
              </div>
              <div className="editor-actions">
                <button type="button" className="button secondary" disabled={!question.trim() || isAsking} onClick={onAsk}>
                  {isAsking ? "回答中..." : "开始资料集问答"}
                </button>
              </div>
              {error ? <p className="feedback error">{error}</p> : null}
              {answer ? (
                <div className="analysis-answer-card">
                  <h4>回答</h4>
                  <p className="analysis-answer">{answer.answer}</p>
                  {answer.referencedTitles.length ? (
                    <div className="collection-answer-sources">
                      <strong>参考资料：</strong>
                      <span>{answer.referencedTitles.join("、")}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <div className="empty-state compact-empty-state collection-empty">
            <div>
              <strong>还没有加入资料。</strong>
              <p>在左侧搜索结果中点击“加入资料集”，先把相关笔记收拢到这里。</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
