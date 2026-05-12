import Link from "next/link";

import { SignOutButton } from "@/components/forms/sign-out-button";
import type { Profile } from "@/lib/types";

interface AppShellProps {
  profile: Profile;
  children: React.ReactNode;
}

export function AppShell({ profile, children }: AppShellProps) {
  const roleLabel = profile.role === "admin" ? "管理员" : "用户";

  return (
    <div className="dashboard-shell grain">
      <div className="dashboard-frame">
        <header className="dashboard-topbar topbar-surface">
          <div className="brand-lockup dashboard-brand">
            <span className="eyebrow">本地知识工作台</span>
            <span className="brand-mark">AI Notes</span>
            <span className="brand-caption">收藏文章，用 AI 拆成真正可复用的学习卡片</span>
          </div>

          <nav className="dashboard-nav">
            <div className="dashboard-nav-links">
              <Link href="/dashboard" className="ghost-button nav-button">
                我的工作台
              </Link>
              {profile.role === "admin" ? (
                <Link href="/dashboard/admin" className="ghost-button nav-button">
                  管理后台
                </Link>
              ) : null}
            </div>
            <div className="dashboard-account-card">
              <div className="dashboard-account-copy">
                <span className="dashboard-account-label">当前登录身份</span>
                <span className="dashboard-account-email">{profile.email}</span>
              </div>
              <span className={`role-pill ${profile.role}`}>{roleLabel}</span>
            </div>
            <div className="dashboard-account-actions">
              <SignOutButton />
            </div>
          </nav>
        </header>

        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
