import { AdminOverview } from "@/components/admin/admin-overview";
import { requireAdminContext } from "@/lib/auth";
import type { Note, Profile } from "@/lib/types";

export default async function AdminDashboardPage() {
  const { supabase, profile } = await requireAdminContext();

  // 后台首页依赖两个独立数据源，直接并发拉取可以减少首屏等待时间。
  const [{ data: profiles, error: profilesError }, { data: notes, error: notesError }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("notes").select("*").order("updated_at", { ascending: false })
  ]);

  if (profilesError || notesError) {
    throw new Error("加载管理员数据失败。");
  }

  return (
    <AdminOverview
      currentAdminId={profile.id}
      profiles={(profiles as Profile[] | null) ?? []}
      notes={(notes as Note[] | null) ?? []}
    />
  );
}
