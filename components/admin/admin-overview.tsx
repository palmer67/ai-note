"use client";

import { useDeferredValue, useState, useTransition } from "react";

import type { AiStatus, AppRole, Note, Profile } from "@/lib/types";

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

export function AdminOverview({ currentAdminId, profiles, notes }: AdminOverviewProps) {
  const [profileRows, setProfileRows] = useState(profiles);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [selectedAiStatus, setSelectedAiStatus] = useState<"all" | AiStatus>("all");
  const [markerKeyword, setMarkerKeyword] = useState("");
  const deferredMarkerKeyword = useDeferredValue(markerKeyword);

  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const adminCount = profileRows.filter((profile) => profile.role === "admin").length;

  const filteredNotes = notes.filter((note) => {
    const matchesUser = selectedUserId === "all" || note.user_id === selectedUserId;
    const matchesStatus = selectedAiStatus === "all" || note.ai_status === selectedAiStatus;
    const matchesMarker = matchesKeyword(note, deferredMarkerKeyword);

    return matchesUser && matchesStatus && matchesMarker;
  });

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

        <div className="admin-table-wrap">
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
              按用户、AI 状态和关键词筛选全局笔记，更快找到你要查看的内容。
            </p>
          </div>
          <span className="inline-badge">当前结果：{filteredNotes.length} 条</span>
        </div>

        <div className="admin-filters">
          <div className="field">
            <label htmlFor="admin-user-filter">按用户筛选</label>
            <select
              id="admin-user-filter"
              className="admin-select"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
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
              onChange={(event) => setSelectedAiStatus(event.target.value as "all" | AiStatus)}
            >
              <option value="all">全部状态</option>
              <option value="idle">未分析</option>
              <option value="loading">分析中</option>
              <option value="done">已完成</option>
              <option value="error">失败</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="admin-marker-filter">按关键词筛选</label>
            <input
              id="admin-marker-filter"
              className="admin-select"
              type="text"
              value={markerKeyword}
              onChange={(event) => setMarkerKeyword(event.target.value)}
              placeholder="搜索标题、标记、链接或正文"
            />
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>归属用户</th>
                <th>标题</th>
                <th>标记</th>
                <th>AI</th>
                <th>更新时间</th>
                <th>正文内容</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.length ? (
                filteredNotes.map((note) => {
                  const owner = profileById.get(note.user_id);

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
                      <td>{note.marker ? <span className="inline-badge">{note.marker}</span> : <span className="muted">无</span>}</td>
                      <td>{getAiStatusLabel(note.ai_status)}</td>
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
                  <td colSpan={6}>
                    <div className="empty-state admin-empty-state">
                      <div>
                        <strong>没有匹配到筛选结果。</strong>
                        <p>你可以切换用户、AI 状态，或者清空关键词重新查看全部笔记。</p>
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
