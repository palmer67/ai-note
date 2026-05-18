import { canExportAiAnalysis } from "@/lib/exports/ai-analysis";
import { getNoteLifecycleLabel } from "@/lib/note-lifecycle";
import { parseTags } from "@/lib/tags";
import type { Note } from "@/lib/types";

interface NotesListProps {
  notes: Note[];
  search: string;
  selectedId: string | null;
  availableTags: string[];
  activeTag: string | null;
  batchMode: boolean;
  selectedExportIds: string[];
  visibleSelectedExportCount: number;
  batchFeedback: string | null;
  batchExportPending: boolean;
  collectionIds: string[];
  onSearchChange: (value: string) => void;
  onCreateNew: () => void;
  onSelect: (note: Note) => void;
  onToggleCollection: (noteId: string) => void;
  onTagFilterChange: (tag: string | null) => void;
  onEnterBatchMode: () => void;
  onExitBatchMode: () => void;
  onToggleBatchSelection: (noteId: string) => void;
  onSelectAllExportable: () => void;
  onClearExportSelection: () => void;
  onBatchExport: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric"
});

export function NotesList({
  notes,
  search,
  selectedId,
  availableTags,
  activeTag,
  batchMode,
  selectedExportIds,
  visibleSelectedExportCount,
  batchFeedback,
  batchExportPending,
  collectionIds,
  onSearchChange,
  onCreateNew,
  onSelect,
  onToggleCollection,
  onTagFilterChange,
  onEnterBatchMode,
  onExitBatchMode,
  onToggleBatchSelection,
  onSelectAllExportable,
  onClearExportSelection,
  onBatchExport
}: NotesListProps) {
  const exportableCount = notes.filter((note) => canExportAiAnalysis(note)).length;
  const batchFeedbackIsError = batchFeedback ? /失败|错误|不可|请先|没有/i.test(batchFeedback) : false;

  return (
    <section className="panel notes-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">已保存文章</h2>
          <p className="panel-subtitle">先搜索，再快速回到你想继续整理的那篇文章。</p>
        </div>
        <div className="notes-panel-actions">
          <span className="inline-badge">{batchMode ? `已选 ${visibleSelectedExportCount} 篇` : `${notes.length} 篇结果`}</span>
          {batchMode ? (
            <>
              <button type="button" className="mini-button" onClick={onSelectAllExportable}>
                全选当前可导出结果
              </button>
              <button type="button" className="mini-button" onClick={onClearExportSelection}>
                取消选择
              </button>
              <button
                type="button"
                className="mini-button primary"
                disabled={!visibleSelectedExportCount || batchExportPending}
                onClick={onBatchExport}
              >
                {batchExportPending ? "导出中..." : "导出所选"}
              </button>
              <button type="button" className="ghost-button" onClick={onExitBatchMode}>
                退出批量模式
              </button>
            </>
          ) : (
            <>
              <button type="button" className="ghost-button" onClick={onCreateNew}>
                新建笔记
              </button>
              <button
                type="button"
                className="mini-button"
                disabled={!exportableCount}
                onClick={onEnterBatchMode}
              >
                批量导出
              </button>
            </>
          )}
        </div>
      </div>

      <input
        className="search-input"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="搜索标题、标签、来源、正文或 AI 分析"
        type="search"
      />

      {availableTags.length ? (
        <div className="tag-filter-bar">
          <button
            type="button"
            className={`tag-filter-chip${activeTag === null ? " active" : ""}`}
            onClick={() => onTagFilterChange(null)}
          >
            全部标签
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tag-filter-chip${activeTag === tag ? " active" : ""}`}
              onClick={() => onTagFilterChange(tag === activeTag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {batchMode && batchFeedback ? (
        <p className={`feedback notes-batch-feedback${batchFeedbackIsError ? " error" : ""}`}>{batchFeedback}</p>
      ) : null}

      <div className="notes-list">
        {notes.length ? (
          notes.map((note) => {
            const tags = parseTags(note.marker);
            const exportable = canExportAiAnalysis(note);
            const selectedForExport = selectedExportIds.includes(note.id);
            const selectedForCollection = collectionIds.includes(note.id);

            return (
              <article
                key={note.id}
                className={[
                  "note-row",
                  !batchMode && selectedId === note.id ? "active" : "",
                  batchMode ? "batch-mode" : "",
                  batchMode && selectedForExport ? "export-selected" : "",
                  batchMode && !exportable ? "export-disabled" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className="note-row-main"
                  disabled={batchMode && !exportable}
                  aria-pressed={batchMode ? selectedForExport : undefined}
                  onClick={() => {
                    if (batchMode) {
                      // 批量导出模式下，整行点击语义切换为“选择导出项”，不再切换当前笔记。
                      if (exportable) {
                        onToggleBatchSelection(note.id);
                      }
                      return;
                    }

                    onSelect(note);
                  }}
                >
                  {batchMode ? (
                    <div className="note-row-selection">
                      <span
                        className={[
                          "selection-indicator",
                          selectedForExport ? "selected" : "",
                          !exportable ? "disabled" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {!exportable ? "不可导出" : selectedForExport ? "已选择" : "选择"}
                      </span>
                    </div>
                  ) : null}

                  <div className="note-row-topline">
                    <span className={`status-badge lifecycle-badge lifecycle-${note.lifecycle_status}`}>
                      {getNoteLifecycleLabel(note.lifecycle_status)}
                    </span>
                    <span className="note-row-date">{dateFormatter.format(new Date(note.updated_at))}</span>
                  </div>

                  <div className="note-row-title">{note.title}</div>

                  <div className="note-row-meta">
                    {tags.length ? (
                      <div className="tag-chip-row compact">
                        {tags.map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">无标签</span>
                    )}
                  </div>

                  {batchMode && !exportable ? <span className="note-row-export-hint">这篇笔记还没有 AI 分析结果</span> : null}
                </button>

                {!batchMode ? (
                  <button
                    type="button"
                    className={`mini-button note-collection-toggle${selectedForCollection ? " active" : ""}`}
                    // 资料集操作按钮独立于整行主按钮，避免出现按钮嵌套按钮的无效结构。
                    onClick={() => onToggleCollection(note.id)}
                  >
                    {selectedForCollection ? "已加入" : "加入资料集"}
                  </button>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="empty-state">
            <div>
              <strong>还没有匹配到笔记。</strong>
              <p>先从一篇你想收藏和消化的文章开始吧。</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
