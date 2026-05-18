"use client";

import { useTransition } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { downloadBatchAiAnalysisZip } from "@/lib/exports/ai-analysis";
import { getNoteLifecycleLabel, type NoteLifecycleView } from "@/lib/note-lifecycle";
import { sortNotes, toDraft } from "@/lib/notes/workspace";
import { serializeTags } from "@/lib/tags";
import type { Note, NoteDraft, NoteLifecycleStatus, Profile } from "@/lib/types";

interface ImportedArticlePayload {
  title: string;
  sourceUrl: string;
  content: string;
  extractionMode: "article" | "fallback";
}

interface UseNoteMutationsOptions {
  supabase: SupabaseClient;
  currentProfile: Profile;
  notes: Note[];
  selectedId: string | null;
  selectedNote: Note | null;
  draft: NoteDraft;
  search: string;
  activeTag: string | null;
  activeLifecycleView: NoteLifecycleView;
  visibleSelectedExportIds: string[];
  exportableFilteredNotes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedExportIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDraft: React.Dispatch<React.SetStateAction<NoteDraft>>;
  setSelectedCollectionIds: React.Dispatch<React.SetStateAction<string[]>>;
  setFeedback: React.Dispatch<React.SetStateAction<string | null>>;
  setAnalysisError: React.Dispatch<React.SetStateAction<string | null>>;
  setBatchFeedback: React.Dispatch<React.SetStateAction<string | null>>;
  pruneSelectedExports: (
    nextNotes: Note[],
    nextSearch: string,
    nextTag: string | null,
    nextLifecycleView: NoteLifecycleView
  ) => void;
}

export function useNoteMutations({
  supabase,
  currentProfile,
  notes,
  selectedId,
  selectedNote,
  draft,
  search,
  activeTag,
  activeLifecycleView,
  visibleSelectedExportIds,
  exportableFilteredNotes,
  setNotes,
  setSelectedId,
  setSelectedExportIds,
  setDraft,
  setSelectedCollectionIds,
  setFeedback,
  setAnalysisError,
  setBatchFeedback,
  pruneSelectedExports
}: UseNoteMutationsOptions) {
  // 这个 hook 统一收口“会改数据库或触发网络请求”的动作，
  // NotesWorkspace 本身只保留状态组合和子组件编排。
  const [savePending, startSave] = useTransition();
  const [lifecyclePending, startLifecycleUpdate] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [analysisPending, startAnalysis] = useTransition();
  const [importPending, startImport] = useTransition();
  const [batchExportPending, startBatchExport] = useTransition();

  function updateSelectedNoteLifecycleStatus(status: NoteLifecycleStatus) {
    if (!selectedId || selectedNote?.lifecycle_status === status) {
      return;
    }

    setFeedback(null);
    setAnalysisError(null);

    startLifecycleUpdate(async () => {
      const { data, error } = await supabase
        .from("notes")
        .update({
          lifecycle_status: status
        })
        .eq("id", selectedId)
        .select("*")
        .single();

      if (error || !data) {
        setFeedback(`状态更新失败：${error?.message ?? "未知错误"}`);
        return;
      }

      const updatedNote = data as unknown as Note;

      setNotes((currentNotes) => {
        const nextNotes = sortNotes(currentNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note)));
        pruneSelectedExports(nextNotes, search, activeTag, activeLifecycleView);
        return nextNotes;
      });
      setFeedback(`状态已更新为「${getNoteLifecycleLabel(updatedNote.lifecycle_status)}」。`);
    });
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
        // 编辑已有笔记时保留当前 lifecycle_status，不让主保存误覆盖即时状态更新。
        const { data, error } = await supabase
          .from("notes")
          .update({
            title: draft.title.trim(),
            source_url: draft.source_url.trim() || null,
            marker,
            content: draft.content.trim(),
            lifecycle_status: selectedNote?.lifecycle_status ?? "inbox"
          })
          .eq("id", selectedId)
          .select("*")
          .single();

        if (error || !data) {
          setFeedback(`保存失败：${error?.message ?? "未知错误"}`);
          return;
        }

        const savedNote = data as unknown as Note;
        const nextNotes = sortNotes(notes.map((note) => (note.id === savedNote.id ? savedNote : note)));

        setNotes(nextNotes);
        pruneSelectedExports(nextNotes, search, activeTag, activeLifecycleView);
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
          content: draft.content.trim(),
          lifecycle_status: "inbox"
        })
        .select("*")
        .single();

      if (error || !data) {
        setFeedback(`保存失败：${error?.message ?? "未知错误"}`);
        return;
      }

      const savedNote = data as unknown as Note;
      const nextNotes = sortNotes([savedNote, ...notes]);

      setNotes(nextNotes);
      pruneSelectedExports(nextNotes, search, activeTag, activeLifecycleView);
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
      // 删除后把选择上下文切到下一条，避免中间编辑区悬空。
      setSelectedCollectionIds((current) => current.filter((id) => id !== selectedId));
      pruneSelectedExports(remaining, search, activeTag, activeLifecycleView);
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
    // 先做本地 optimistic 更新，让右侧 AI 面板立即显示“分析中”。
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

      const nextNotes = sortNotes(notes.map((note) => (note.id === payload.note?.id ? payload.note : note)));

      setNotes(nextNotes);
      pruneSelectedExports(nextNotes, search, activeTag, activeLifecycleView);
      setFeedback("AI 分析结果已保存到当前笔记。");
    });
  }

  function handleSelectAllExportable() {
    if (!exportableFilteredNotes.length) {
      setBatchFeedback("当前筛选结果里没有可导出的 AI 分析内容。");
      return;
    }

    setBatchFeedback(null);
    setSelectedExportIds(exportableFilteredNotes.map((note) => note.id));
  }

  function handleClearExportSelection() {
    setBatchFeedback(null);
    setSelectedExportIds([]);
  }

  function handleBatchExport() {
    const notesToExport = exportableFilteredNotes.filter((note) => visibleSelectedExportIds.includes(note.id));

    if (!notesToExport.length) {
      setBatchFeedback("请先选择至少一篇已完成 AI 分析的笔记。");
      return;
    }

    setBatchFeedback(null);

    startBatchExport(async () => {
      try {
        await downloadBatchAiAnalysisZip(notesToExport);
        setBatchFeedback(`已导出 ${notesToExport.length} 篇笔记，压缩包中包含 Markdown、JSON 和 HTML。`);
      } catch (error) {
        setBatchFeedback(error instanceof Error ? `批量导出失败：${error.message}` : "批量导出失败。");
      }
    });
  }

  return {
    savePending,
    lifecyclePending,
    deletePending,
    analysisPending,
    importPending,
    batchExportPending,
    updateSelectedNoteLifecycleStatus,
    handleSave,
    handleDelete,
    handleImportFromUrl,
    handleAnalyze,
    handleSelectAllExportable,
    handleClearExportSelection,
    handleBatchExport
  };
}
