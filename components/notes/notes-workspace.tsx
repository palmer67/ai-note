"use client";

import Link from "next/link";
import { useDeferredValue, useState, useTransition } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Note, NoteDraft, Profile } from "@/lib/types";
import { AiAnalysisPanel } from "@/components/notes/ai-analysis-panel";
import { NoteEditor } from "@/components/notes/note-editor";
import { NotesList } from "@/components/notes/notes-list";

interface NotesWorkspaceProps {
  currentProfile: Profile;
  initialNotes: Note[];
}

const blankDraft: NoteDraft = {
  title: "",
  source_url: "",
  marker: "",
  content: ""
};

function toDraft(note: Note | null): NoteDraft {
  if (!note) {
    return blankDraft;
  }

  return {
    title: note.title,
    source_url: note.source_url ?? "",
    marker: note.marker ?? "",
    content: note.content
  };
}

function sortNotes(notes: Note[]) {
  return [...notes].sort((left, right) => {
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

function matchesSearch(note: Note, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [note.title, note.marker ?? "", note.content].some((value) => value.toLowerCase().includes(normalized));
}

export function NotesWorkspace({ currentProfile, initialNotes }: NotesWorkspaceProps) {
  const supabase = createClient();
  const [notes, setNotes] = useState(() => sortNotes(initialNotes));
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const [draft, setDraft] = useState<NoteDraft>(() => toDraft(initialNotes[0] ?? null));
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [analysisPending, startAnalysis] = useTransition();

  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;
  const filteredNotes = notes.filter((note) => matchesSearch(note, deferredSearch));

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

  function updateDraft(field: keyof NoteDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value
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

      if (selectedId) {
        const { data, error } = await supabase
          .from("notes")
          .update({
            title: draft.title.trim(),
            source_url: draft.source_url.trim() || null,
            marker: draft.marker.trim() || null,
            content: draft.content.trim(),
            ai_summary: null,
            ai_status: "idle"
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
        setFeedback("笔记已保存。如果你修改了正文，可以重新执行 AI 分析。");
        return;
      }

      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: currentProfile.id,
          title: draft.title.trim(),
          source_url: draft.source_url.trim() || null,
          marker: draft.marker.trim() || null,
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
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h1 className="panel-title">你的阅读工作台</h1>
            <p className="panel-subtitle">
              这里是前端的主要操作区。下方笔记列表来自 Supabase，右侧 AI 分析则通过后端安全路由完成，
              因为模型密钥不能直接暴露在浏览器里。
            </p>
          </div>
          <div className="inline-actions">
            <span className={`role-pill ${currentProfile.role}`}>{currentProfile.email}</span>
            {currentProfile.role === "admin" ? (
              <Link href="/dashboard/admin" className="ghost-button">
                查看全部用户
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="workspace-grid">
        <NotesList
          notes={filteredNotes}
          search={search}
          selectedId={selectedId}
          onSearchChange={setSearch}
          onCreateNew={createNewNote}
          onSelect={selectNote}
        />

        <NoteEditor
          draft={draft}
          hasSavedNote={Boolean(selectedId)}
          isSaving={savePending}
          isDeleting={deletePending}
          feedback={feedback}
          onChange={updateDraft}
          onSave={handleSave}
          onDelete={handleDelete}
        />

        <AiAnalysisPanel
          note={selectedNote}
          isAnalyzing={analysisPending || selectedNote?.ai_status === "loading"}
          error={analysisError}
          onAnalyze={handleAnalyze}
        />
      </div>
    </div>
  );
}
