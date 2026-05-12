"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";

import { canExportAiAnalysis, downloadBatchAiAnalysisZip } from "@/lib/exports/ai-analysis";
import { getNoteLifecycleLabel, noteLifecycleOptions } from "@/lib/note-lifecycle";
import { parseTags } from "@/lib/tags";
import type { AiStatus, AppRole, Note, NoteLifecycleStatus, Profile } from "@/lib/types";

interface AdminOverviewProps {
  currentAdminId: string;
  profiles: Profile[];
  notes: Note[];
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

function previewText(content: string) {
  if (content.length <= 180) {
    return content;
  }

  return `${content.slice(0, 180).trim()}...`;
}

function getAiStatusLabel(status: Note["ai_status"]) {
  switch (status) {
    case "idle":
      return "未分析";
    case "loading":
      return "分析中";
    case "done":
      return "已完成";
    case "error":
      return "失败";
    default:
      return status;
  }
}

function getRoleLabel(role: AppRole) {
  return role === "admin" ? "管理员" : "用户";
}

function matchesKeyword(note: Note, keyword: string) {
  const normalized = keyword.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [note.title, note.marker ?? "", note.content, note.source_url ?? ""].some((value) =>
    value.toLowerCase().includes(normalized)
  );
}

interface AdminNoteFilterState {
  userId: string;
  aiStatus: "all" | AiStatus;
  lifecycleStatus: "all" | NoteLifecycleStatus;
  keyword: string;
}

function getScopedNotesForFilters(notes: Note[], filters: AdminNoteFilterState) {
  return notes.filter((note) => {
    const matchesUser = filters.userId === "all" || note.user_id === filters.userId;
    const matchesAiStatus = filters.aiStatus === "all" || note.ai_status === filters.aiStatus;
    const matchesLifecycle = filters.lifecycleStatus === "all" || note.lifecycle_status === filters.lifecycleStatus;
    const matchesMarker = matchesKeyword(note, filters.keyword);

    return matchesUser && matchesAiStatus && matchesLifecycle && matchesMarker;
  });
}

function getAvailableTagsForNotes(notes: Note[]) {
  return Array.from(new Set(notes.flatMap((note) => parseTags(note.marker)))).sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  );
}

export function AdminOverview({ currentAdminId, profiles, notes }: AdminOverviewProps) {
  const [profileRows, setProfileRows] = useState(profiles);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notesFeedback, setNotesFeedback] = useState<string | null>(null);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [exportPending, startExport] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [selectedAiStatus, setSelectedAiStatus] = useState<"all" | AiStatus>("all");
  const [selectedLifecycleStatus, setSelectedLifecycleStatus] = useState<"all" | NoteLifecycleStatus>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [markerKeyword, setMarkerKeyword] = useState("");
  const deferredMarkerKeyword = useDeferredValue(markerKeyword);

  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const adminCount = profileRows.filter((profile) => profile.role === "admin").length;

  const scopedNotes = getScopedNotesForFilters(notes, {
    userId: selectedUserId,
    aiStatus: selectedAiStatus,
    lifecycleStatus: selectedLifecycleStatus,
    keyword: deferredMarkerKeyword
  });

  const availableTags = useMemo(() => getAvailableTagsForNotes(scopedNotes), [scopedNotes]);
  const effectiveActiveTag = activeTag && availableTags.includes(activeTag) ? activeTag : null;
  const filteredNotes = scopedNotes.filter((note) =>
    effectiveActiveTag ? parseTags(note.marker).includes(effectiveActiveTag) : true
  );
  const exportableFilteredNotes = filteredNotes.filter((note) => canExportAiAnalysis(note));
  const lifecycleCounts = useMemo(
    () => ({
      inbox: notes.filter((note) => note.lifecycle_status === "inbox").length,
      distilled: notes.filter((note) => note.lifecycle_status === "distilled").length,
      archived: notes.filter((note) => note.lifecycle_status === "archived").length
    }),
    [notes]
  );

  function maybeResetActiveTagForFilterChange(nextFilters: AdminNoteFilterState) {
    if (!activeTag) {
      return;
    }

    const nextAvailableTags = getAvailableTagsForNotes(getScopedNotesForFilters(notes, nextFilters));

    if (!nextAvailableTags.includes(activeTag)) {
      setActiveTag(null);
      setNotesFeedback("当前标签筛选已重置，因为它不在新的结果范围内。");
    }
  }

  function handleRoleToggle(targetProfile: Profile) {
    const nextRole: AppRole = targetProfile.role === "admin" ? "user" : "admin";

    setFeedback(null);
    setPendingProfileId(targetProfile.id);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/profiles/role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            targetProfileId: targetProfile.id,
            role: nextRole
          })
        });

        const payload = (await response.json()) as {
          error?: string;
          profile?: Profile;
        };

        if (!response.ok || !payload.profile) {
          setFeedback(payload.error ?? "角色更新失败。");
          return;
        }

        setProfileRows((current) =>
          current.map((profile) => (profile.id === payload.profile?.id ? payload.profile : profile))
        );
        setFeedback(`已将 ${payload.profile.email} 设置为${getRoleLabel(payload.profile.role)}。`);
      } catch {
        setFeedback("角色更新时发生网络错误。");
      } finally {
        setPendingProfileId(null);
      }
    });
  }

  function handleExportFilteredNotes() {
    if (!exportableFilteredNotes.length) {
      setNotesFeedback("当前筛选结果里没有可导出的 AI 分析内容。");
      return;
    }

    setNotesFeedback(null);

    startExport(async () => {
      try {
        await downloadBatchAiAnalysisZip(exportableFilteredNotes);
        setNotesFeedback(`已导出 ${exportableFilteredNotes.length} 条笔记，压缩包中包含 Markdown、JSON 和 HTML。`);
      } catch (error) {
        setNotesFeedback(error instanceof Error ? `导出失败：${error.message}` : "导出失败。");
      }
    });
  }

  return (
    <section className="admin-grid">
      <div className="panel overview-banner">
        <div className="panel-header">
          <div>
            <span className="eyebrow">系统总览</span>
            <h1 className="panel-title">管理员总览中心</h1>
            <p className="panel-subtitle">
              这里可以查看全局用户与全部笔记，也可以安全地调整其他用户的角色。
            </p>
          </div>
          <span className="role-pill admin">全局只读 + 角色管理</span>
        </div>
        <div className="admin-summary-strip">
          <article className="summary-chip">
            <strong>{profileRows.length}</strong>
            <span>总账号数</span>
          </article>
          <article className="summary-chip">
            <strong>{adminCount}</strong>
            <span>管理员数量</span>
          </article>
          <article className="summary-chip">
            <strong>{notes.length}</strong>
            <span>已保存文章数</span>
          </article>
          <article className="summary-chip">
            <strong>{lifecycleCounts.inbox}</strong>
            <span>待整理</span>
          </article>
          <article className="summary-chip">
            <strong>{lifecycleCounts.distilled}</strong>
            <span>已提炼</span>
          </article>
          <article className="summary-chip">
            <strong>{lifecycleCounts.archived}</strong>
            <span>已归档</span>
          </article>
        </div>
        {feedback ? <p className={`feedback${feedback.includes("失败") || feedback.includes("错误") ? " error" : ""}`}>{feedback}</p> : null}
      </div>

      <div className="panel admin-section-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">用户列表</h2>
            <p className="panel-subtitle">
              管理员可以调整别人的角色。为了防止误操作，当前登录管理员不能修改自己的角色。
            </p>
          </div>
        </div>

        <div className="admin-table-wrap admin-table-wrap-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>邮箱</th>
                <th>角色</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {profileRows.map((profile) => {
                const isCurrentAdmin = profile.id === currentAdminId;
                const isSavingThisRow = pending && pendingProfileId === profile.id;

                return (
                  <tr key={profile.id}>
                    <td>{profile.email}</td>
                    <td>
                      <span className={`role-pill ${profile.role}`}>{getRoleLabel(profile.role)}</span>
                    </td>
                    <td>{dateFormatter.format(new Date(profile.created_at))}</td>
                    <td>
                      {isCurrentAdmin ? (
                        <span className="muted">当前账号不可改</span>
                      ) : (
                        <div className="table-actions">
                          <button
                            type="button"
                            className={`mini-button${profile.role === "user" ? " primary" : ""}`}
                            disabled={isSavingThisRow}
                            onClick={() => handleRoleToggle(profile)}
                          >
                            {isSavingThisRow
                              ? "保存中..."
                              : profile.role === "admin"
                                ? "降为用户"
                                : "设为管理员"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel admin-section-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">全部笔记</h2>
            <p className="panel-subtitle">
              按用户、AI 状态、知识状态、标签和关键词筛选全局笔记，并可直接导出当前筛选结果。
            </p>
          </div>
          <div className="admin-notes-header-actions">
            <span className="inline-badge">当前结果：{filteredNotes.length} 条</span>
            <button
              type="button"
              className="mini-button primary"
              disabled={!exportableFilteredNotes.length || exportPending}
              onClick={handleExportFilteredNotes}
            >
              {exportPending ? "导出中..." : "导出当前筛选结果"}
            </button>
          </div>
        </div>

        <div className="admin-filter-stack">
          <div className="admin-filters admin-filters-four">
            <div className="field">
              <label htmlFor="admin-user-filter">按用户筛选</label>
              <select
                id="admin-user-filter"
                className="admin-select"
                value={selectedUserId}
                onChange={(event) => {
                  const nextUserId = event.target.value;

                  setSelectedUserId(nextUserId);
                  maybeResetActiveTagForFilterChange({
                    userId: nextUserId,
                    aiStatus: selectedAiStatus,
                    lifecycleStatus: selectedLifecycleStatus,
                    keyword: deferredMarkerKeyword
                  });
                }}
              >
                <option value="all">全部用户</option>
                {profileRows.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="admin-status-filter">按 AI 状态筛选</label>
              <select
                id="admin-status-filter"
                className="admin-select"
                value={selectedAiStatus}
                onChange={(event) => {
                  const nextAiStatus = event.target.value as "all" | AiStatus;

                  setSelectedAiStatus(nextAiStatus);
                  maybeResetActiveTagForFilterChange({
                    userId: selectedUserId,
                    aiStatus: nextAiStatus,
                    lifecycleStatus: selectedLifecycleStatus,
                    keyword: deferredMarkerKeyword
                  });
                }}
              >
                <option value="all">全部状态</option>
                <option value="idle">未分析</option>
                <option value="loading">分析中</option>
                <option value="done">已完成</option>
                <option value="error">失败</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="admin-lifecycle-filter">按知识状态筛选</label>
              <select
                id="admin-lifecycle-filter"
                className="admin-select"
                value={selectedLifecycleStatus}
                onChange={(event) => {
                  const nextLifecycleStatus = event.target.value as "all" | NoteLifecycleStatus;

                  setSelectedLifecycleStatus(nextLifecycleStatus);
                  maybeResetActiveTagForFilterChange({
                    userId: selectedUserId,
                    aiStatus: selectedAiStatus,
                    lifecycleStatus: nextLifecycleStatus,
                    keyword: deferredMarkerKeyword
                  });
                }}
              >
                <option value="all">全部状态</option>
                {noteLifecycleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="admin-marker-filter">按关键词筛选</label>
              <input
                id="admin-marker-filter"
                className="admin-select"
                type="text"
                value={markerKeyword}
                onChange={(event) => {
                  const nextKeyword = event.target.value;

                  setMarkerKeyword(nextKeyword);
                  maybeResetActiveTagForFilterChange({
                    userId: selectedUserId,
                    aiStatus: selectedAiStatus,
                    lifecycleStatus: selectedLifecycleStatus,
                    keyword: nextKeyword
                  });
                }}
                placeholder="搜索标题、标记、链接或正文"
              />
            </div>
          </div>

          {availableTags.length ? (
            <div className="admin-tag-section">
              <span className="admin-tag-label">按标签筛选</span>
              <div className="tag-filter-bar admin-tag-filter-bar">
                <button
                  type="button"
                  className={`tag-filter-chip${effectiveActiveTag === null ? " active" : ""}`}
                  onClick={() => setActiveTag(null)}
                >
                  全部标签
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-filter-chip${effectiveActiveTag === tag ? " active" : ""}`}
                    onClick={() => setActiveTag(tag === effectiveActiveTag ? null : tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {notesFeedback ? <p className={`feedback${notesFeedback.includes("失败") ? " error" : ""}`}>{notesFeedback}</p> : null}
        </div>

        <div className="admin-table-wrap admin-notes-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>归属用户</th>
                <th>标题</th>
                <th>标签</th>
                <th>AI</th>
                <th>知识状态</th>
                <th>更新时间</th>
                <th>正文内容</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.length ? (
                filteredNotes.map((note) => {
                  const owner = profileById.get(note.user_id);
                  const tags = parseTags(note.marker);

                  return (
                    <tr key={note.id}>
                      <td>{owner?.email ?? "未知用户"}</td>
                      <td>
                        <strong>{note.title}</strong>
                        {note.source_url ? (
                          <div>
                            <a className="small-link" href={note.source_url} rel="noreferrer" target="_blank">
                              来源链接
                            </a>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {tags.length ? (
                          <div className="admin-tag-stack">
                            {tags.map((tag) => (
                              <span key={tag} className="tag-chip">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">无</span>
                        )}
                      </td>
                      <td>{getAiStatusLabel(note.ai_status)}</td>
                      <td>
                        <span className={`status-badge lifecycle-badge lifecycle-${note.lifecycle_status}`}>
                          {getNoteLifecycleLabel(note.lifecycle_status)}
                        </span>
                      </td>
                      <td>{dateFormatter.format(new Date(note.updated_at))}</td>
                      <td>
                        <details>
                          <summary>{previewText(note.content)}</summary>
                          <p className="muted">{note.content}</p>
                        </details>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state admin-empty-state">
                      <div>
                        <strong>没有匹配到筛选结果。</strong>
                        <p>你可以切换用户、AI 状态、知识状态，或者清空关键词重新查看全部笔记。</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
