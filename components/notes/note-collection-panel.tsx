import { getNoteAiStatusLabel } from "@/lib/note-ai-status";
import { getNoteLifecycleLabel } from "@/lib/note-lifecycle";
import { parseTags } from "@/lib/tags";
import type { Note } from "@/lib/types";

interface NoteCollectionPanelProps {
  notes: Note[];
  onSelect: (note: Note) => void;
  onRemove: (noteId: string) => void;
  onClear: () => void;
}

export function NoteCollectionPanel({ notes, onSelect, onRemove, onClear }: NoteCollectionPanelProps) {
  const analyzedCount = notes.filter((note) => note.ai_summary).length;
  const pendingCount = notes.length - analyzedCount;

  return (
    <section className="panel collection-panel">
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
          notes.map((note) => {
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
          })
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
