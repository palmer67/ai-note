import type { NoteDraft } from "@/lib/types";

interface NoteEditorProps {
  draft: NoteDraft;
  hasSavedNote: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  feedback: string | null;
  onChange: (field: keyof NoteDraft, value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}

export function NoteEditor({
  draft,
  hasSavedNote,
  isSaving,
  isDeleting,
  feedback,
  onChange,
  onSave,
  onDelete
}: NoteEditorProps) {
  const isError = feedback ? /failed|required|invalid|失败|错误|无效/i.test(feedback) : false;

  return (
    <section className="panel editor-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">{hasSavedNote ? "编辑笔记" : "新建笔记"}</h2>
          <p className="panel-subtitle">
            先把文章内容保存下来。只要你改了正文，就可以重新生成一版 AI 分析。
          </p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="note-title">标题</label>
        <input
          id="note-title"
          value={draft.title}
          onChange={(event) => onChange("title", event.target.value)}
          placeholder="给这篇文章起一个清楚的标题"
        />
      </div>

      <div className="field">
        <label htmlFor="note-source">来源链接</label>
        <input
          id="note-source"
          value={draft.source_url}
          onChange={(event) => onChange("source_url", event.target.value)}
          placeholder="https://example.com/article"
        />
      </div>

      <div className="field">
        <label htmlFor="note-marker">标记</label>
        <input
          id="note-marker"
          value={draft.marker}
          onChange={(event) => onChange("marker", event.target.value)}
          placeholder="比如：值得重读、产品、AI、方法论"
        />
      </div>

      <div className="field">
        <label htmlFor="note-content">文章正文</label>
        <textarea
          id="note-content"
          value={draft.content}
          onChange={(event) => onChange("content", event.target.value)}
          placeholder="把文章正文粘贴到这里"
        />
      </div>

      {feedback ? <p className={`feedback${isError ? " error" : ""}`}>{feedback}</p> : null}

      <div className="editor-actions">
        <button type="button" className="button" disabled={isSaving} onClick={onSave}>
          {isSaving ? "保存中..." : hasSavedNote ? "保存修改" : "保存笔记"}
        </button>
        <button type="button" className="danger-button" disabled={!hasSavedNote || isDeleting} onClick={onDelete}>
          {isDeleting ? "删除中..." : "删除笔记"}
        </button>
      </div>
    </section>
  );
}
