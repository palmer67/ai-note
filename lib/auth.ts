import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null }
) {
  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return existingProfile as Profile;
  }

  if (selectError) {
    throw new Error(`读取用户资料失败：${selectError.message}`);
  }

  const { data: insertedProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      role: "user"
    })
    .select("*")
    .single();

  if (insertError || !insertedProfile) {
    throw new Error(`用户资料缺失，且自动补建失败：${insertError?.message ?? "未知错误"}`);
  }

  return insertedProfile as Profile;
}

export async function requireSessionContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/signin");
  }

  const profile = await ensureProfile(supabase, user);

  return {
    supabase,
    user,
    profile
  };
}

export async function requireAdminContext() {
  const context = await requireSessionContext();

  if (context.profile.role !== "admin") {
    redirect("/dashboard");
  }

  return context;
}
