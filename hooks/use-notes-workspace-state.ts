"use client";

import { useMemo, useState } from "react";

import { canExportAiAnalysis } from "@/lib/exports/ai-analysis";
import type { NoteLifecycleView } from "@/lib/note-lifecycle";
import {
  blankDraft,
  getAvailableTags,
  getCollectionNotes,
  getFilteredNotes,
  sortNotes,
  toDraft
} from "@/lib/notes/workspace";
import type { Note, NoteDraft } from "@/lib/types";

export function useNotesWorkspaceState(initialNotes: Note[]) {
  // 这个 hook 只负责页面内存状态，不直接发请求，
  // 这样筛选、选择和临时资料集逻辑可以单独收口。
  const [notes, setNotes] = useState(() => sortNotes(initialNotes));
  // 工作台首次进入时不默认选中任何笔记，避免页面一打开就强行进入某条记录详情。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(() => blankDraft);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeLifecycleView, setActiveLifecycleView] = useState<NoteLifecycleView>("all");
  const [batchMode, setBatchMode] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;
  const availableTags = getAvailableTags(notes);
  const analyzedCount = notes.filter((note) => note.ai_status === "done").length;
  const filteredNotes = getFilteredNotes(notes, search, activeTag, activeLifecycleView);
  const collectionNotes = getCollectionNotes(notes, selectedCollectionIds);
  const lifecycleCounts = useMemo(
    () => ({
      all: notes.length,
      inbox: notes.filter((note) => note.lifecycle_status === "inbox").length,
      distilled: notes.filter((note) => note.lifecycle_status === "distilled").length,
      archived: notes.filter((note) => note.lifecycle_status === "archived").length
    }),
    [notes]
  );
  const exportableFilteredNotes = filteredNotes.filter((note) => canExportAiAnalysis(note));
  const visibleSelectedExportIds = selectedExportIds.filter((id) =>
    exportableFilteredNotes.some((note) => note.id === id)
  );

  function pruneSelectedExports(
    nextNotes: Note[],
    nextSearch: string,
    nextTag: string | null,
    nextLifecycleView: NoteLifecycleView
  ) {
    if (!batchMode) {
      return;
    }

    const visibleExportIds = new Set(
      getFilteredNotes(nextNotes, nextSearch, nextTag, nextLifecycleView)
        .filter((note) => canExportAiAnalysis(note))
        .map((note) => note.id)
    );

    setSelectedExportIds((current) => current.filter((id) => visibleExportIds.has(id)));
  }

  function selectNote(note: Note) {
    if (batchMode) {
      // 批量导出模式下不允许切换当前编辑上下文，避免左中右三栏状态打架。
      return;
    }

    setSelectedId(note.id);
    setDraft(toDraft(note));
  }

  function createNewNote() {
    if (batchMode) {
      return;
    }

    setSelectedId(null);
    setDraft(blankDraft);
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

  function handleEnterBatchMode() {
    // 进入批量模式时清空旧选择，避免跨筛选条件带入过期勾选状态。
    setBatchMode(true);
    setSelectedExportIds([]);
    setBatchFeedback(null);
  }

  function handleExitBatchMode() {
    setBatchMode(false);
    setSelectedExportIds([]);
    setBatchFeedback(null);
  }

  function handleToggleBatchSelection(noteId: string) {
    setBatchFeedback(null);
    setSelectedExportIds((current) =>
      current.includes(noteId) ? current.filter((id) => id !== noteId) : [...current, noteId]
    );
  }

  function handleToggleCollection(noteId: string) {
    setSelectedCollectionIds((current) =>
      current.includes(noteId) ? current.filter((id) => id !== noteId) : [...current, noteId]
    );
  }

  function handleRemoveFromCollection(noteId: string) {
    setSelectedCollectionIds((current) => current.filter((id) => id !== noteId));
  }

  function handleClearCollection() {
    setSelectedCollectionIds([]);
  }

  return {
    notes,
    setNotes,
    selectedId,
    setSelectedId,
    draft,
    setDraft,
    search,
    setSearch,
    activeTag,
    setActiveTag,
    activeLifecycleView,
    setActiveLifecycleView,
    batchMode,
    selectedExportIds,
    setSelectedExportIds,
    selectedCollectionIds,
    setSelectedCollectionIds,
    batchFeedback,
    setBatchFeedback,
    selectedNote,
    availableTags,
    analyzedCount,
    filteredNotes,
    collectionNotes,
    lifecycleCounts,
    exportableFilteredNotes,
    visibleSelectedExportIds,
    pruneSelectedExports,
    selectNote,
    createNewNote,
    updateDraft,
    updateTags,
    handleEnterBatchMode,
    handleExitBatchMode,
    handleToggleBatchSelection,
    handleToggleCollection,
    handleRemoveFromCollection,
    handleClearCollection
  };
}
