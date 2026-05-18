import { NextResponse } from "next/server";

import { importArticleFromUrl } from "@/lib/articles/import-from-url";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录后再导入链接。" }, { status: 401 });
  }

  let sourceUrl: string | undefined;

  try {
    const body = (await request.json()) as { sourceUrl?: string };
    sourceUrl = body.sourceUrl?.trim();
  } catch {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  if (!sourceUrl) {
    return NextResponse.json({ error: "请先填写来源链接。" }, { status: 400 });
  }

  try {
    const article = await importArticleFromUrl(sourceUrl);

    return NextResponse.json({
      article,
      // extractionMode 用来区分“正文可信度较高”还是“仅拿到基础内容”。
      message:
        article.extractionMode === "article"
          ? "已自动导入标题和正文，你可以继续补充或修改。"
          : "已导入基础内容，正文可能需要你再手动补充和清理。"
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "导入链接时发生了未知错误。"
      },
      { status: 400 }
    );
  }
}
