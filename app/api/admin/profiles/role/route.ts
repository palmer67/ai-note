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

  // 角色切换的并发安全和“保留最后一个管理员”约束都在数据库 RPC 里处理。
  const { data: updatedProfile, error } = await supabase.rpc("update_profile_role_safely", {
    actor_user_id: user.id,
    target_profile_id: targetProfileId,
    next_role: nextRole
  });

  if (error || !updatedProfile) {
    return NextResponse.json(
      {
        error: error?.message ?? "角色更新失败。"
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    profile: updatedProfile as Profile
  });
}
