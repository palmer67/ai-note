import { NextResponse } from "next/server";

import { analyzeNote } from "@/lib/openai/analyze-note";
import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录后再使用 AI 分析功能。" }, { status: 401 });
  }

  let noteId: string | null = null;

  try {
    const body = (await request.json()) as { noteId?: string };
    noteId = body.noteId ?? null;
  } catch {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  if (!noteId) {
    return NextResponse.json({ error: "缺少 note id。" }, { status: 400 });
  }

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return NextResponse.json({ error: "没有找到对应的笔记。" }, { status: 404 });
  }

  await supabase.from("notes").update({ ai_status: "loading" }).eq("id", noteId);

  try {
    const breakdown = await analyzeNote({
      title: note.title,
      sourceUrl: note.source_url,
      marker: note.marker,
      content: note.content
    });

    const { data: updatedNote, error: updateError } = await supabase
      .from("notes")
      .update({
        ai_summary: breakdown,
        ai_status: "done"
      })
      .eq("id", noteId)
      .select("*")
      .single();

    if (updateError || !updatedNote) {
      throw new Error(updateError?.message ?? "AI 分析结果保存失败。");
    }

    return NextResponse.json({
      note: updatedNote as Note
    });
  } catch (error) {
    await supabase.from("notes").update({ ai_status: "error" }).eq("id", noteId);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI 分析时发生了意外错误。"
      },
      { status: 500 }
    );
  }
}
