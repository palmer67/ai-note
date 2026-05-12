"use client";

import { useState } from "react";

import { getNoteLifecycleLabel, noteLifecycleOptions } from "@/lib/note-lifecycle";
import { parseTags } from "@/lib/tags";
import type { NoteDraft, NoteLifecycleStatus } from "@/lib/types";

interface NoteEditorProps {
  draft: NoteDraft;
  hasSavedNote: boolean;
  lifecycleStatus: NoteLifecycleStatus;
  isSaving: boolean;
  isSavingLifecycleStatus: boolean;
  isDeleting: boolean;
  isImporting: boolean;
  feedback: string | null;
  onChange: (field: "title" | "source_url" | "content", value: string) => void;
  onLifecycleStatusChange: (status: NoteLifecycleStatus) => void;
  onTagsChange: (tags: string[]) => void;
  onSave: () => void;
  onDelete: () => void;
  onImportFromUrl: () => void;
}

export function NoteEditor({
  draft,
  hasSavedNote,
  lifecycleStatus,
  isSaving,
  isSavingLifecycleStatus,
  isDeleting,
  isImporting,
  feedback,
  onChange,
  onLifecycleStatusChange,
  onTagsChange,
  onSave,
  onDelete,
  onImportFromUrl
}: NoteEditorProps) {
  const [tagInput, setTagInput] = useState("");
  const isError = feedback ? /failed|required|invalid|失败|错误|无效/i.test(feedback) : false;

  function commitTag(rawTag: string) {
    const nextTags = parseTags(rawTag);

    if (!nextTags.length) {
      setTagInput("");
      return;
    }

    onTagsChange(Array.from(new Set([...draft.tags, ...nextTags])));
    setTagInput("");
  }

  function removeTag(tagToRemove: string) {
    onTagsChange(draft.tags.filter((tag) => tag !== tagToRemove));
  }

  return (
    <section className="panel editor-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">{hasSavedNote ? "编辑笔记" : "新建笔记"}</h2>
          <p className="panel-subtitle">先把文章内容保存下来。改了正文后，你可以随时重新生成一版 AI 分析。</p>
        </div>
        <div className="editor-lifecycle">
          <label htmlFor="note-lifecycle-status">当前状态</label>
          <select
            id="note-lifecycle-status"
            className="admin-select"
            value={lifecycleStatus}
            disabled={!hasSavedNote || isSavingLifecycleStatus}
            onChange={(event) => onLifecycleStatusChange(event.target.value as NoteLifecycleStatus)}
          >
            {noteLifecycleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="inline-badge">
            {isSavingLifecycleStatus ? "保存状态中..." : getNoteLifecycleLabel(lifecycleStatus)}
          </span>
        </div>
      </div>

      <div className="editor-scroll">
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
          <div className="import-row">
            <input
              id="note-source"
              value={draft.source_url}
              onChange={(event) => onChange("source_url", event.target.value)}
              placeholder="https://example.com/article"
            />
            <button type="button" className="ghost-button" disabled={isImporting} onClick={onImportFromUrl}>
              {isImporting ? "导入中..." : "导入链接"}
            </button>
          </div>
          <p className="help-text">自动抓取标题和正文，抓不全的部分你仍然可以手动补充。</p>
        </div>

        <div className="field">
          <label htmlFor="note-tag-input">标签</label>
          <div className="tag-chip-row">
            {draft.tags.length ? (
              draft.tags.map((tag) => (
                <button key={tag} type="button" className="tag-chip removable" onClick={() => removeTag(tag)}>
                  <span>{tag}</span>
                  <span aria-hidden="true">×</span>
                </button>
              ))
            ) : (
              <span className="muted">还没有标签，输入后按回车或逗号添加。</span>
            )}
          </div>
          <input
            id="note-tag-input"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onBlur={() => commitTag(tagInput)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "," || event.key === "，") {
                event.preventDefault();
                commitTag(tagInput);
              }
            }}
            placeholder="输入标签后按回车、英文逗号或中文逗号"
          />
          <p className="help-text">支持一次性粘贴多个标签，例如：AI, 写作, 方法论。</p>
        </div>

        <div className="field note-content-field">
          <label htmlFor="note-content">文章正文</label>
          <textarea
            id="note-content"
            value={draft.content}
            onChange={(event) => onChange("content", event.target.value)}
            placeholder="把文章正文粘贴到这里，或者先通过链接自动导入"
          />
        </div>
      </div>

      <div className="editor-footer">
        {feedback ? <p className={`feedback${isError ? " error" : ""}`}>{feedback}</p> : null}

        <div className="editor-actions">
          <button type="button" className="button" disabled={isSaving} onClick={onSave}>
            {isSaving ? "保存中..." : hasSavedNote ? "保存修改" : "保存笔记"}
          </button>
          <button type="button" className="danger-button" disabled={!hasSavedNote || isDeleting} onClick={onDelete}>
            {isDeleting ? "删除中..." : "删除笔记"}
          </button>
        </div>
      </div>
    </section>
  );
}
