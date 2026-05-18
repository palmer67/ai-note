import { AppShell } from "@/components/layout/app-shell";
import { requireSessionContext } from "@/lib/auth";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 布局层先拿到当前业务身份，再把它传给统一壳子渲染顶部导航。
  const { profile } = await requireSessionContext();

  return <AppShell profile={profile}>{children}</AppShell>;
}
