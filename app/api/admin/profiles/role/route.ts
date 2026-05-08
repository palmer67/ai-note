import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

interface RoleUpdateRequest {
  targetProfileId?: string;
  role?: AppRole;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (currentProfileError || !currentProfile) {
    return NextResponse.json({ error: "无法确认当前管理员身份。" }, { status: 403 });
  }

  if ((currentProfile as Profile).role !== "admin") {
    return NextResponse.json({ error: "只有管理员可以修改角色。" }, { status: 403 });
  }

  let body: RoleUpdateRequest;

  try {
    body = (await request.json()) as RoleUpdateRequest;
  } catch {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  const targetProfileId = body.targetProfileId?.trim();
  const nextRole = body.role;

  if (!targetProfileId || (nextRole !== "admin" && nextRole !== "user")) {
    return NextResponse.json({ error: "缺少目标用户或角色参数。" }, { status: 400 });
  }

  if (targetProfileId === user.id) {
    return NextResponse.json({ error: "当前账号不能修改自己的角色。" }, { status: 400 });
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", targetProfileId)
    .single();

  if (targetProfileError || !targetProfile) {
    return NextResponse.json({ error: "没有找到要修改的用户。" }, { status: 404 });
  }

  if ((targetProfile as Profile).role === "admin" && nextRole === "user") {
    const { count, error: countError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) {
      return NextResponse.json({ error: "检查管理员数量失败。" }, { status: 500 });
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "系统里至少要保留一个管理员。" }, { status: 400 });
    }
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      role: nextRole
    })
    .eq("id", targetProfileId)
    .select("*")
    .single();

  if (updateError || !updatedProfile) {
    return NextResponse.json({ error: "角色更新失败。" }, { status: 500 });
  }

  return NextResponse.json({
    profile: updatedProfile as Profile
  });
}
