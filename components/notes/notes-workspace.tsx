"use client";

import { useState, useTransition } from "react";

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
import type { Note, Profile, SavedNoteCollection } from "@/lib/types";

interface NotesWorkspaceProps {
  currentProfile: Profile;
  initialNotes: Note[];
  initialCollections?: SavedNoteCollection[];
}

export function NotesWorkspace({ currentProfile, initialNotes, initialCollections = [] }: NotesWorkspaceProps) {
  const supabase = createClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [savedCollections, setSavedCollections] = useState(() => initialCollections);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionFeedback, setCollectionFeedback] = useState<string | null>(null);
  const [collectionQuestion, setCollectionQuestion] = useState("");
  const [collectionAnswer, setCollectionAnswer] = useState<import("@/lib/types").CollectionAnswer | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [collectionAskPending, startCollectionAsk] = useTransition();
  const [collectionSavePending, startCollectionSave] = useTransition();
  const [collectionUpdatePending, startCollectionUpdate] = useTransition();
  const [collectionDeletePending, startCollectionDelete] = useTransition();
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

  function resetCollectionQa() {
    setCollectionQuestion("");
    setCollectionAnswer(null);
    setCollectionError(null);
  }

  function getCollectionInput() {
    return {
      name: collectionName.trim(),
      description: collectionDescription.trim() || null,
      noteIds: [...selectedCollectionIds]
    };
  }

  async function replaceSavedCollectionItems(collectionId: string, noteIds: string[]) {
    const { error } = await supabase.rpc("replace_note_collection_items", {
      target_collection_id: collectionId,
      target_note_ids: noteIds
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  function normalizeSavedCollection(
    collection: Omit<SavedNoteCollection, "note_ids">,
    noteIds: string[]
  ): SavedNoteCollection {
    return {
      ...collection,
      note_ids: noteIds
    };
  }

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
    onNoteDeleted: (noteId) => {
      setSavedCollections((current) =>
        current.map((collection) => ({
          ...collection,
          note_ids: collection.note_ids.filter((collectionNoteId) => collectionNoteId !== noteId)
        }))
      );
    },
    pruneSelectedExports
  });

  function handleSaveCollection() {
    const { name, description, noteIds } = getCollectionInput();
    setCollectionFeedback(null);

    if (!noteIds.length) {
      setCollectionFeedback("请先选择至少一篇资料。");
      return;
    }

    if (!name) {
      setCollectionFeedback("资料集名称不能为空。");
      return;
    }

    startCollectionSave(async () => {
      const { data, error } = await supabase
        .from("note_collections")
        .insert({
          user_id: currentProfile.id,
          name,
          description
        })
        .select("*")
        .single();

      if (error || !data) {
        setCollectionFeedback(`保存资料集失败：${error?.message ?? "未知错误"}`);
        return;
      }

      const collection = data as Omit<SavedNoteCollection, "note_ids">;

      try {
        await replaceSavedCollectionItems(collection.id, noteIds);
      } catch (saveError) {
        await supabase.from("note_collections").delete().eq("id", collection.id);
        setCollectionFeedback(saveError instanceof Error ? `保存资料集失败：${saveError.message}` : "保存资料集失败。");
        return;
      }

      const savedCollection = normalizeSavedCollection(collection, noteIds);

      setSavedCollections((current) => [savedCollection, ...current]);
      setActiveCollectionId(savedCollection.id);
      setCollectionName(savedCollection.name);
      setCollectionDescription(savedCollection.description ?? "");
      setCollectionFeedback("资料集已保存。");
    });
  }

  function handleUpdateCollection() {
    const { name, description, noteIds } = getCollectionInput();
    setCollectionFeedback(null);

    if (!activeCollectionId) {
      setCollectionFeedback("请先载入一个已保存资料集。");
      return;
    }

    if (!noteIds.length) {
      setCollectionFeedback("请先选择至少一篇资料。");
      return;
    }

    if (!name) {
      setCollectionFeedback("资料集名称不能为空。");
      return;
    }

    startCollectionUpdate(async () => {
      const { data, error } = await supabase
        .from("note_collections")
        .update({
          name,
          description
        })
        .eq("id", activeCollectionId)
        .select("*")
        .single();

      if (error || !data) {
        setCollectionFeedback(`更新资料集失败：${error?.message ?? "未知错误"}`);
        return;
      }

      try {
        await replaceSavedCollectionItems(activeCollectionId, noteIds);
      } catch (updateError) {
        setCollectionFeedback(updateError instanceof Error ? `更新资料集失败：${updateError.message}` : "更新资料集失败。");
        return;
      }

      const updatedCollection = normalizeSavedCollection(data as Omit<SavedNoteCollection, "note_ids">, noteIds);

      setSavedCollections((current) =>
        [updatedCollection, ...current.filter((collection) => collection.id !== updatedCollection.id)].sort(
          (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
        )
      );
      setCollectionName(updatedCollection.name);
      setCollectionDescription(updatedCollection.description ?? "");
      setCollectionFeedback("资料集已更新。");
    });
  }

  function handleLoadCollection(collectionId: string) {
    const collection = savedCollections.find((item) => item.id === collectionId);

    if (!collection) {
      return;
    }

    const availableNoteIds = new Set(notes.map((note) => note.id));
    const nextNoteIds = collection.note_ids.filter((noteId) => availableNoteIds.has(noteId));

    setSelectedCollectionIds(nextNoteIds);
    setActiveCollectionId(collection.id);
    setCollectionName(collection.name);
    setCollectionDescription(collection.description ?? "");
    resetCollectionQa();
    setCollectionFeedback(
      nextNoteIds.length === collection.note_ids.length
        ? "资料集已载入。"
        : "资料集已载入，部分已删除的资料已自动跳过。"
    );
  }

  function handleDeleteCollection(collectionId: string) {
    const collection = savedCollections.find((item) => item.id === collectionId);

    if (!collection) {
      return;
    }

    const confirmed = window.confirm(`确定删除资料集「${collection.name}」吗？资料集里的原始笔记不会被删除。`);

    if (!confirmed) {
      return;
    }

    setCollectionFeedback(null);

    startCollectionDelete(async () => {
      const { error } = await supabase.from("note_collections").delete().eq("id", collectionId);

      if (error) {
        setCollectionFeedback(`删除资料集失败：${error.message}`);
        return;
      }

      setSavedCollections((current) => current.filter((item) => item.id !== collectionId));

      if (activeCollectionId === collectionId) {
        setActiveCollectionId(null);
        setCollectionName("");
        setCollectionDescription("");
      }

      setCollectionFeedback("资料集已删除，原始笔记已保留。");
    });
  }

  function handleCollectionMembershipToggle(noteId: string) {
    handleToggleCollection(noteId);
    resetCollectionQa();
  }

  function handleCollectionNoteRemove(noteId: string) {
    handleRemoveFromCollection(noteId);
    resetCollectionQa();
  }

  function handleAskCollection() {
    setCollectionError(null);
    setCollectionAnswer(null);

    startCollectionAsk(async () => {
      const response = await fetch("/api/ai/ask-collection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          noteIds: selectedCollectionIds,
          question: collectionQuestion
        })
      });

      const payload = (await response.json()) as {
        answer?: string;
        referencedTitles?: string[];
        error?: string;
      };

      if (!response.ok || !payload.answer) {
        setCollectionError(payload.error ?? "资料集问答失败。");
        return;
      }

      setCollectionAnswer({
        answer: payload.answer,
        referencedTitles: payload.referencedTitles ?? []
      });
    });
  }

  function handleClearCollectionWithQaReset() {
    handleClearCollection();
    resetCollectionQa();
    setActiveCollectionId(null);
    setCollectionName("");
    setCollectionDescription("");
    setCollectionFeedback(null);
  }

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
          onToggleCollection={handleCollectionMembershipToggle}
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
            savedCollections={savedCollections}
            activeCollectionId={activeCollectionId}
            collectionName={collectionName}
            collectionDescription={collectionDescription}
            collectionFeedback={collectionFeedback}
            isSavingCollection={collectionSavePending}
            isUpdatingCollection={collectionUpdatePending}
            isDeletingCollection={collectionDeletePending}
            onSelect={selectNote}
            onRemove={handleCollectionNoteRemove}
            onClear={handleClearCollectionWithQaReset}
            onCollectionNameChange={setCollectionName}
            onCollectionDescriptionChange={setCollectionDescription}
            onSaveCollection={handleSaveCollection}
            onUpdateCollection={handleUpdateCollection}
            onLoadCollection={handleLoadCollection}
            onDeleteCollection={handleDeleteCollection}
            question={collectionQuestion}
            answer={collectionAnswer}
            error={collectionError}
            isAsking={collectionAskPending}
            onQuestionChange={setCollectionQuestion}
            onAsk={handleAskCollection}
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
