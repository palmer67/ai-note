"use client";

import { useState } from "react";

import { AiAnalysisPanel } from "@/components/notes/ai-analysis-panel";
import { NoteCollectionPanel } from "@/components/notes/note-collection-panel";
import { NoteEditor } from "@/components/notes/note-editor";
import { NotesList } from "@/components/notes/notes-list";
import {
  getNoteLifecycleLabel,
  noteLifecycleViewOptions
} from "@/lib/note-lifecycle";
import {
  useNotesWorkspaceState
} from "@/hooks/use-notes-workspace-state";
import { useNoteMutations } from "@/hooks/use-note-mutations";
import { createClient } from "@/lib/supabase/client";
import type { Note, Profile } from "@/lib/types";

interface NotesWorkspaceProps {
  currentProfile: Profile;
  initialNotes: Note[];
}

export function NotesWorkspace({ currentProfile, initialNotes }: NotesWorkspaceProps) {
  const supabase = createClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const workspaceState = useNotesWorkspaceState(initialNotes);
  const {
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
    setSelectedCollectionIds,
    selectedCollectionIds,
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
  } = workspaceState;
  const {
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
  } = useNoteMutations({
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
    setSelectedExportIds: workspaceState.setSelectedExportIds,
    setDraft,
    setSelectedCollectionIds,
    setFeedback,
    setAnalysisError,
    setBatchFeedback,
    pruneSelectedExports
  });

  return (
    <div className="stack notes-workspace">
      <section className="panel workspace-overview-panel">
        <div className="panel-header">
          <div className="workspace-heading">
            <span className="eyebrow">阅读与分析</span>
            <h1 className="panel-title">你的阅读工作台</h1>
            <p className="panel-subtitle">
              这里是主要操作区。左侧用来筛选和管理笔记，中间负责整理内容，右侧可以生成和导出 AI 分析结果。
            </p>
          </div>
          <div className="inline-actions">
            <span className={`role-pill ${currentProfile.role}`}>{currentProfile.email}</span>
          </div>
        </div>

        <div className="workspace-summary-strip">
          {noteLifecycleViewOptions.map((view) => (
            <button
              key={view.value}
              type="button"
              className={`summary-chip summary-chip-button${activeLifecycleView === view.value ? " active" : ""}`}
              onClick={() => {
                setActiveLifecycleView(view.value);
                pruneSelectedExports(notes, search, activeTag, view.value);
              }}
            >
              <strong>{lifecycleCounts[view.value]}</strong>
              <span>{view.label}</span>
            </button>
          ))}
          <article className="summary-chip">
            <strong>{availableTags.length}</strong>
            <span>常用标签</span>
          </article>
          <article className="summary-chip">
            <strong>{analyzedCount}</strong>
            <span>已完成 AI 分析</span>
          </article>
          <article className="summary-chip summary-chip-wide">
            <strong>{selectedNote ? getNoteLifecycleLabel(selectedNote.lifecycle_status) : "未选择"}</strong>
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
          batchMode={batchMode}
          selectedExportIds={selectedExportIds}
          visibleSelectedExportCount={visibleSelectedExportIds.length}
          batchFeedback={batchFeedback}
          batchExportPending={batchExportPending}
          collectionIds={selectedCollectionIds}
          onSearchChange={(value) => {
            setSearch(value);
            pruneSelectedExports(notes, value, activeTag, activeLifecycleView);
          }}
          onCreateNew={createNewNote}
          onSelect={selectNote}
          onToggleCollection={handleToggleCollection}
          onTagFilterChange={(value) => {
            setActiveTag(value);
            pruneSelectedExports(notes, search, value, activeLifecycleView);
          }}
          onEnterBatchMode={handleEnterBatchMode}
          onExitBatchMode={handleExitBatchMode}
          onToggleBatchSelection={handleToggleBatchSelection}
          onSelectAllExportable={handleSelectAllExportable}
          onClearExportSelection={handleClearExportSelection}
          onBatchExport={handleBatchExport}
        />

        <NoteEditor
          draft={draft}
          hasSavedNote={Boolean(selectedId)}
          lifecycleStatus={selectedNote?.lifecycle_status ?? "inbox"}
          isSaving={savePending}
          isSavingLifecycleStatus={lifecyclePending}
          isDeleting={deletePending}
          isImporting={importPending}
          feedback={feedback}
          onChange={updateDraft}
          onLifecycleStatusChange={updateSelectedNoteLifecycleStatus}
          onTagsChange={updateTags}
          onSave={handleSave}
          onDelete={handleDelete}
          onImportFromUrl={handleImportFromUrl}
        />

        <div className="workspace-side-stack">
          <NoteCollectionPanel
            notes={collectionNotes}
            onSelect={selectNote}
            onRemove={handleRemoveFromCollection}
            onClear={handleClearCollection}
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
    </div>
  );
}
