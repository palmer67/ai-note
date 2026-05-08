import { AppShell } from "@/components/layout/app-shell";
import { requireSessionContext } from "@/lib/auth";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { profile } = await requireSessionContext();

  return <AppShell profile={profile}>{children}</AppShell>;
}
