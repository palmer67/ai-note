import { parseTags } from "@/lib/tags";
import type { Note } from "@/lib/types";

interface NotesListProps {
  notes: Note[];
  search: string;
  selectedId: string | null;
  availableTags: string[];
  activeTag: string | null;
  onSearchChange: (value: string) => void;
  onCreateNew: () => void;
  onSelect: (note: Note) => void;
  onTagFilterChange: (tag: string | null) => void;
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
  onSearchChange,
  onCreateNew,
  onSelect,
  onTagFilterChange
}: NotesListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">已保存文章</h2>
          <p className="panel-subtitle">先搜索，再快速回到你想继续整理的那篇文章。</p>
        </div>
        <button type="button" className="ghost-button" onClick={onCreateNew}>
          新建笔记
        </button>
      </div>

      <input
        className="search-input"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="搜索标题、标签或正文内容"
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

      <div className="notes-list">
        {notes.length ? (
          notes.map((note) => {
            const tags = parseTags(note.marker);

            return (
              <button
                key={note.id}
                type="button"
                className={`note-row${selectedId === note.id ? " active" : ""}`}
                onClick={() => onSelect(note)}
              >
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
                  ) : null}
                  <span className="note-row-date">{dateFormatter.format(new Date(note.updated_at))}</span>
                </div>
              </button>
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
