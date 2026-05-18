import { NextResponse } from "next/server";

import { askNote } from "@/lib/openai/ask-note";
import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录后再使用笔记问答功能。" }, { status: 401 });
  }

  let noteId: string | null = null;
  let question: string | null = null;

  try {
    const body = (await request.json()) as { noteId?: string; question?: string };
    noteId = body.noteId?.trim() ?? null;
    question = body.question?.trim() ?? null;
  } catch {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  if (!noteId) {
    return NextResponse.json({ error: "缺少 note id。" }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "请先输入你的问题。" }, { status: 400 });
  }

  // 问答链路只返回答案，不修改数据库里的 AI 分析结果。
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return NextResponse.json({ error: "没有找到对应的笔记。" }, { status: 404 });
  }

  try {
    const answer = await askNote({
      title: note.title,
      sourceUrl: note.source_url,
      marker: note.marker,
      content: note.content,
      summary: note.ai_summary,
      question
    });

    return NextResponse.json({
      answer,
      note: note as Note
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "笔记问答时发生了意外错误。"
      },
      { status: 500 }
    );
  }
}
