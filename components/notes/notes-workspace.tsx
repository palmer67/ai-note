"use client";
import { useDeferredValue, useState, useTransition } from "react";

import { AiAnalysisPanel } from "@/components/notes/ai-analysis-panel";
import { NoteEditor } from "@/components/notes/note-editor";
import { NotesList } from "@/components/notes/notes-list";
import { createClient } from "@/lib/supabase/client";
import { parseTags, serializeTags } from "@/lib/tags";
import type { Note, NoteDraft, Profile } from "@/lib/types";

interface NotesWorkspaceProps {
  currentProfile: Profile;
  initialNotes: Note[];
}

interface ImportedArticlePayload {
  title: string;
  sourceUrl: string;
  content: string;
  extractionMode: "article" | "fallback";
}

const blankDraft: NoteDraft = {
  title: "",
  source_url: "",
  tags: [],
  content: ""
};

function toDraft(note: Note | null): NoteDraft {
  if (!note) {
    return blankDraft;
  }

  return {
    title: note.title,
    source_url: note.source_url ?? "",
    tags: parseTags(note.marker),
    content: note.content
  };
}

function sortNotes(notes: Note[]) {
  return [...notes].sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
}

function matchesSearch(note: Note, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  const tags = parseTags(note.marker).join(" ");

  return [note.title, tags, note.content].some((value) => value.toLowerCase().includes(normalized));
}

export function NotesWorkspace({ currentProfile, initialNotes }: NotesWorkspaceProps) {
  const supabase = createClient();
  const [notes, setNotes] = useState(() => sortNotes(initialNotes));
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const [draft, setDraft] = useState<NoteDraft>(() => toDraft(initialNotes[0] ?? null));
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [analysisPending, startAnalysis] = useTransition();
  const [importPending, startImport] = useTransition();

  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;
  const availableTags = Array.from(new Set(notes.flatMap((note) => parseTags(note.marker)))).sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  );
  const analyzedCount = notes.filter((note) => note.ai_status === "done").length;

  const filteredNotes = notes.filter((note) => {
    const matchesKeywordSearch = matchesSearch(note, deferredSearch);
    const matchesTagFilter = activeTag ? parseTags(note.marker).includes(activeTag) : true;

    return matchesKeywordSearch && matchesTagFilter;
  });

  function selectNote(note: Note) {
    setSelectedId(note.id);
    setDraft(toDraft(note));
    setFeedback(null);
    setAnalysisError(null);
  }

  function createNewNote() {
    setSelectedId(null);
    setDraft(blankDraft);
    setFeedback(null);
    setAnalysisError(null);
  }

  function updateDraft(field: "title" | "source_url" | "content", value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateTags(tags: string[]) {
    setDraft((current) => ({
      ...current,
      tags
    }));
  }

  function handleSave() {
    setFeedback(null);
    setAnalysisError(null);

    startSave(async () => {
      if (!draft.title.trim() || !draft.content.trim()) {
        setFeedback("保存前请至少填写标题和文章正文。");
        return;
      }

      const marker = serializeTags(draft.tags) || null;

      if (selectedId) {
        const { data, error } = await supabase
          .from("notes")
          .update({
            title: draft.title.trim(),
            source_url: draft.source_url.trim() || null,
            marker,
            content: draft.content.trim()
          })
          .eq("id", selectedId)
          .select("*")
          .single();

        if (error || !data) {
          setFeedback(`保存失败：${error?.message ?? "未知错误"}`);
          return;
        }

        const savedNote = data as unknown as Note;
        setNotes((current) => sortNotes(current.map((note) => (note.id === savedNote.id ? savedNote : note))));
        setDraft(toDraft(savedNote));
        setFeedback("笔记已保存。现有 AI 分析会保留；如果你想基于新内容更新分析，可以手动重新运行。");
        return;
      }

      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: currentProfile.id,
          title: draft.title.trim(),
          source_url: draft.source_url.trim() || null,
          marker,
          content: draft.content.trim()
        })
        .select("*")
        .single();

      if (error || !data) {
        setFeedback(`保存失败：${error?.message ?? "未知错误"}`);
        return;
      }

      const savedNote = data as unknown as Note;
      setNotes((current) => sortNotes([savedNote, ...current]));
      setSelectedId(savedNote.id);
      setDraft(toDraft(savedNote));
      setFeedback("笔记已保存。现在可以在右侧发起 AI 分析。");
    });
  }

  function handleDelete() {
    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm("确定删除这条笔记吗？删除后不能恢复。");

    if (!confirmed) {
      return;
    }

    setFeedback(null);
    setAnalysisError(null);

    startDelete(async () => {
      const { error } = await supabase.from("notes").delete().eq("id", selectedId);

      if (error) {
        setFeedback(`删除失败：${error.message}`);
        return;
      }

      const remaining = notes.filter((note) => note.id !== selectedId);
      const nextSelected = remaining[0] ?? null;

      setNotes(remaining);
      setSelectedId(nextSelected?.id ?? null);
      setDraft(toDraft(nextSelected));
      setFeedback("笔记已删除。");
    });
  }

  function handleImportFromUrl() {
    setFeedback(null);
    setAnalysisError(null);

    startImport(async () => {
      if (!draft.source_url.trim()) {
        setFeedback("请先填写来源链接，再尝试导入。");
        return;
      }

      const response = await fetch("/api/articles/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceUrl: draft.source_url.trim()
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        article?: ImportedArticlePayload;
      };

      if (!response.ok || !payload.article) {
        setFeedback(payload.error ?? "链接导入失败。");
        return;
      }

      setDraft((current) => ({
        ...current,
        title: payload.article?.title ?? current.title,
        source_url: payload.article?.sourceUrl ?? current.source_url,
        content: payload.article?.content ?? current.content
      }));
      setFeedback(payload.message ?? "已自动导入文章内容，你可以继续手动补充。");
    });
  }

  function handleAnalyze() {
    if (!selectedId) {
      setAnalysisError("请先保存笔记，再让 AI 分析。");
      return;
    }

    setAnalysisError(null);
    setFeedback(null);
    setNotes((current) =>
      current.map((note) => (note.id === selectedId ? { ...note, ai_status: "loading" } : note))
    );

    startAnalysis(async () => {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          noteId: selectedId
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        note?: Note;
      };

      if (!response.ok || !payload.note) {
        setNotes((current) =>
          current.map((note) => (note.id === selectedId ? { ...note, ai_status: "error" } : note))
        );
        setAnalysisError(payload.error ?? "AI 分析失败。");
        return;
      }

      setNotes((current) => sortNotes(current.map((note) => (note.id === payload.note?.id ? payload.note : note))));
      setFeedback("AI 分析结果已保存到当前笔记。");
    });
  }

  return (
    <div className="stack notes-workspace">
      <section className="panel workspace-overview-panel">
        <div className="panel-header">
          <div className="workspace-heading">
            <span className="eyebrow">阅读与分析</span>
            <h1 className="panel-title">你的阅读工作台</h1>
            <p className="panel-subtitle">
              这里是前端的主要操作区。下方笔记列表来自 Supabase，右侧 AI 分析则通过后端安全路由完成，
              因为模型密钥不能直接暴露在浏览器里。
            </p>
          </div>
          <div className="inline-actions">
            <span className={`role-pill ${currentProfile.role}`}>{currentProfile.email}</span>
          </div>
        </div>
        <div className="workspace-summary-strip">
          <article className="summary-chip">
            <strong>{notes.length}</strong>
            <span>已保存文章</span>
          </article>
          <article className="summary-chip">
            <strong>{availableTags.length}</strong>
            <span>常用标签</span>
          </article>
          <article className="summary-chip">
            <strong>{analyzedCount}</strong>
            <span>已完成 AI 分析</span>
          </article>
          <article className="summary-chip summary-chip-wide">
            <strong>{selectedNote ? "进行中" : "未选择"}</strong>
            <span>{selectedNote ? selectedNote.title : "选择一篇文章开始工作"}</span>
          </article>
        </div>
      </section>

      <div className="workspace-grid">
        <NotesList
          notes={filteredNotes}
          search={search}
          selectedId={selectedId}
          availableTags={availableTags}
          activeTag={activeTag}
          onSearchChange={setSearch}
          onCreateNew={createNewNote}
          onSelect={selectNote}
          onTagFilterChange={setActiveTag}
        />

        <NoteEditor
          draft={draft}
          hasSavedNote={Boolean(selectedId)}
          isSaving={savePending}
          isDeleting={deletePending}
          isImporting={importPending}
          feedback={feedback}
          onChange={updateDraft}
          onTagsChange={updateTags}
          onSave={handleSave}
          onDelete={handleDelete}
          onImportFromUrl={handleImportFromUrl}
        />

        <AiAnalysisPanel
          key={selectedNote?.id ?? "empty-note-panel"}
          note={selectedNote}
          isAnalyzing={analysisPending || selectedNote?.ai_status === "loading"}
          error={analysisError}
          onAnalyze={handleAnalyze}
        />
      </div>
    </div>
  );
}
