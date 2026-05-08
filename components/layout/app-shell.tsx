import Link from "next/link";

import { SignOutButton } from "@/components/forms/sign-out-button";
import type { Profile } from "@/lib/types";

interface AppShellProps {
  profile: Profile;
  children: React.ReactNode;
}

export function AppShell({ profile, children }: AppShellProps) {
  return (
    <div className="dashboard-shell grain">
      <div className="dashboard-frame">
        <header className="dashboard-topbar">
          <div className="brand-lockup">
            <span className="brand-mark">AI Notes</span>
            <span className="brand-caption">收藏文章，用 AI 拆成真正可复用的学习卡片</span>
          </div>

          <nav className="dashboard-nav">
            <Link href="/dashboard" className="ghost-button">
              我的工作台
            </Link>
            {profile.role === "admin" ? (
              <Link href="/dashboard/admin" className="ghost-button">
                管理后台
              </Link>
            ) : null}
            <span className={`role-pill ${profile.role}`}>{profile.role === "admin" ? "管理员" : "用户"}</span>
            <SignOutButton />
          </nav>
        </header>

        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
